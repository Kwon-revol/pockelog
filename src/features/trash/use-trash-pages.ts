"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { TrashPage } from "@/features/trash/types";

export type LoadTrashPage = (cursor: string) => Promise<TrashPage>;

class SessionExpiredError extends Error {}
class TrashAccessRevokedError extends Error {}

export async function fetchTrashPage(cursor: string): Promise<TrashPage> {
  const params = new URLSearchParams({ cursor });
  const response = await fetch(`/api/trash?${params}`);
  if (response.status === 401) throw new SessionExpiredError("로그인이 필요합니다.");
  if (response.status === 403) throw new TrashAccessRevokedError("휴지통을 볼 권한이 없습니다.");
  if (!response.ok) throw new Error("휴지통을 불러오지 못했습니다.");
  return response.json() as Promise<TrashPage>;
}

export function useTrashPages(
  initialPage: TrashPage,
  loadPage: LoadTrashPage = fetchTrashPage,
) {
  const router = useRouter();
  const [items, setItems] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestInFlightRef = useRef(false);

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const setItemPending = useCallback((id: string, pending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const requestNextPage = useCallback(async () => {
    if (!nextCursor || requestInFlightRef.current || accessRevoked) return;
    requestInFlightRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const page = await loadPage(nextCursor);
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        const additions = page.items.filter((item) => {
          if (known.has(item.id)) return false;
          known.add(item.id);
          return true;
        });
        return [...current, ...additions];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        router.push("/login?next=%2Fsettings%2Ftrash");
      } else if (error instanceof TrashAccessRevokedError) {
        setItems([]);
        setNextCursor(null);
        setAccessRevoked(true);
      } else {
        setLoadError("추가 휴지통 내역을 불러오지 못했습니다.");
      }
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, [accessRevoked, loadPage, nextCursor, router]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor || loading || loadError || accessRevoked) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void requestNextPage();
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [accessRevoked, loadError, loading, nextCursor, requestNextPage]);

  return {
    accessRevoked,
    hasNext: Boolean(nextCursor),
    items,
    loadError,
    loading,
    nextCursor,
    pendingIds,
    removeItem,
    requestNextPage,
    sentinelRef,
    setItemPending,
  };
}

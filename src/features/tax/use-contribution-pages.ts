"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  TaxContributionPage,
} from "@/features/tax/types";

export type LoadContributionPage = (
  year: number,
  cursor: string,
) => Promise<TaxContributionPage>;

class SessionExpiredError extends Error {}

export async function fetchContributionPage(year: number, cursor: string) {
  const params = new URLSearchParams({ year: String(year), cursor });
  const response = await fetch(`/api/tax-contributions?${params}`);
  if (response.status === 401) throw new SessionExpiredError("로그인이 필요합니다.");
  if (!response.ok) throw new Error("납입 내역을 불러오지 못했습니다.");
  return response.json() as Promise<TaxContributionPage>;
}

export function useContributionPages(
  initialPage: TaxContributionPage,
  year: number,
  loadPage: LoadContributionPage = fetchContributionPage,
) {
  const router = useRouter();
  const [items, setItems] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestInFlightRef = useRef(false);

  const requestNextPage = useCallback(async () => {
    if (!nextCursor || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const page = await loadPage(year, nextCursor);
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
        const next = `${window.location.pathname}${window.location.search}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
      } else {
        setLoadError("추가 납입 내역을 불러오지 못했습니다.");
      }
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, [loadPage, nextCursor, router, year]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor || loading || loadError) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void requestNextPage();
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadError, loading, nextCursor, requestNextPage]);

  return {
    items,
    hasNext: Boolean(nextCursor),
    loading,
    loadError,
    sentinelRef,
    requestNextPage,
  };
}

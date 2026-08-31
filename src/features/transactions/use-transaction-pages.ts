"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  TransactionFilters,
  TransactionPage,
} from "@/features/transactions/types";

export type LoadTransactionPage = (
  filters: TransactionFilters,
  cursor: string,
) => Promise<TransactionPage>;

class SessionExpiredError extends Error {}

export async function fetchTransactionPage(
  filters: TransactionFilters,
  cursor: string,
) {
  const params = new URLSearchParams({
    cursor,
    start: filters.startOn,
    end: filters.endOn,
    q: filters.query,
    type: filters.type,
    sort: filters.sort,
  });
  if (filters.categoryId) params.set("category", filters.categoryId);
  const response = await fetch(`/api/transactions?${params}`);
  if (response.status === 401) throw new SessionExpiredError("로그인이 필요합니다.");
  if (!response.ok) throw new Error("내역을 불러오지 못했습니다.");
  return response.json() as Promise<TransactionPage>;
}

export function useTransactionPages(
  initialPage: TransactionPage,
  filters: TransactionFilters,
  loadPage: LoadTransactionPage = fetchTransactionPage,
) {
  const router = useRouter();
  const [items, setItems] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    setItems(initialPage.items);
    setNextCursor(initialPage.nextCursor);
    setLoadError(null);
  }, [initialPage]);

  const removeItem = useCallback((transactionId: string) => {
    setItems((current) => current.filter((item) => item.id !== transactionId));
  }, []);

  const requestNextPage = useCallback(async () => {
    if (!nextCursor || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const page = await loadPage(filters, nextCursor);
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !known.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        const next = `${window.location.pathname}${window.location.search}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
      } else {
        setLoadError("추가 내역을 불러오지 못했습니다.");
      }
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, [filters, loadPage, nextCursor, router]);

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
    removeItem,
  };
}

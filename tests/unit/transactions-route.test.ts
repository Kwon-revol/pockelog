import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTransactionPageParams } from "@/features/transactions/route-contract";
import { fetchTransactionPage } from "@/features/transactions/use-transaction-pages";

describe("transaction page route contract", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("rejects a malformed cursor", () => {
    expect(parseTransactionPageParams(new URLSearchParams("cursor=broken"))).toEqual({
      ok: false,
      message: "잘못된 조회 요청입니다.",
    });
  });

  it("normalizes the complete filter set for the next request", () => {
    const cursor = Buffer.from(JSON.stringify({
      occurredOn: "2026-08-26",
      createdAt: "2026-08-26T01:02:03.000Z",
      id: "11111111-1111-4111-8111-111111111111",
    })).toString("base64url");
    const result = parseTransactionPageParams(new URLSearchParams({
      cursor,
      start: "2026-08-01",
      end: "2026-08-31",
      q: "  점심  ",
      type: "expense",
      category: "22222222-2222-4222-8222-222222222222",
      sort: "oldest",
    }));

    expect(result).toEqual({
      ok: true,
      cursor,
      filters: {
        startOn: "2026-08-01",
        endOn: "2026-08-31",
        endExclusive: "2026-09-01",
        query: "점심",
        type: "expense",
        categoryId: "22222222-2222-4222-8222-222222222222",
        sort: "oldest",
      },
    });
  });

  it("rejects a missing or reversed date range", () => {
    expect(parseTransactionPageParams(new URLSearchParams({
      cursor: Buffer.from("{}").toString("base64url"),
      start: "2026-09-01",
      end: "2026-08-01",
    }))).toMatchObject({ ok: false });
  });

  it("accepts an initial statistics page with a validated category group filter", () => {
    const result = parseTransactionPageParams(new URLSearchParams(
      "start=2026-08-01&end=2026-08-31&type=expense&categories=11111111-1111-4111-8111-111111111111&categories=22222222-2222-4222-8222-222222222222",
    ));
    expect(result).toMatchObject({
      ok: true,
      cursor: "",
      filters: {
        categoryIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
        ],
      },
    });
  });

  it("rejects malformed grouped categories instead of broadening the transaction query", () => {
    expect(parseTransactionPageParams(new URLSearchParams(
      "start=2026-08-01&end=2026-08-31&categories=not-a-uuid",
    ))).toMatchObject({ ok: false });
  });

  it("carries the same category group filter into the initial and next page requests", async () => {
    const fetchedUrls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      fetchedUrls.push(url);
      return { ok: true, status: 200, json: async () => ({ items: [], nextCursor: null }) };
    });
    vi.stubGlobal("fetch", fetcher);
    const filters = {
      startOn: "2026-08-01", endOn: "2026-08-31", endExclusive: "2026-09-01",
      query: "", type: "expense" as const, categoryId: null, sort: "newest" as const,
      categoryIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
    };
    await fetchTransactionPage(filters, "");
    await fetchTransactionPage(filters, "cursor-2");

    const first = new URL(fetchedUrls[0], "https://example.com");
    const second = new URL(fetchedUrls[1], "https://example.com");
    expect(first.searchParams.get("cursor")).toBeNull();
    expect(second.searchParams.get("cursor")).toBe("cursor-2");
    expect(first.searchParams.getAll("categories")).toEqual(filters.categoryIds);
    expect(second.searchParams.getAll("categories")).toEqual(filters.categoryIds);
  });
});

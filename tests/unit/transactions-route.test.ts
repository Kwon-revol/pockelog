import { describe, expect, it } from "vitest";

import { parseTransactionPageParams } from "@/features/transactions/route-contract";

describe("transaction page route contract", () => {
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
});

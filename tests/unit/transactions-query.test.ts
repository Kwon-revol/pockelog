import { describe, expect, it } from "vitest";

import {
  buildCursorFilter,
  getCreatorProfileSource,
  sanitizeSearchTerm,
  toTransactionPage,
} from "@/features/transactions/query-utils";

const cursor = {
  occurredOn: "2026-08-26",
  createdAt: "2026-08-26T01:02:03.000Z",
  id: "11111111-1111-4111-8111-111111111111",
};

describe("transaction query boundaries", () => {
  it("uses the new creator RPC only for shared ledgers", () => {
    expect(getCreatorProfileSource("personal")).toBe("profiles");
    expect(getCreatorProfileSource("shared")).toBe("rpc");
  });

  it("continues newest sorting strictly after the complete cursor key", () => {
    expect(buildCursorFilter(cursor, "newest")).toBe(
      "occurred_on.lt.2026-08-26,and(occurred_on.eq.2026-08-26,created_at.lt.2026-08-26T01:02:03.000Z),and(occurred_on.eq.2026-08-26,created_at.eq.2026-08-26T01:02:03.000Z,id.lt.11111111-1111-4111-8111-111111111111)",
    );
  });

  it("continues oldest sorting strictly after the complete cursor key", () => {
    expect(buildCursorFilter(cursor, "oldest")).toContain("occurred_on.gt.2026-08-26");
    expect(buildCursorFilter(cursor, "oldest")).toContain("id.gt.11111111-1111-4111-8111-111111111111");
  });

  it("removes PostgREST grouping punctuation from a search term", () => {
    expect(sanitizeSearchTerm("  점심,(회사)  ")).toBe("점심 회사");
  });

  it("uses the fifty-first row only to determine the next cursor", () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      id: `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000000`,
      type: "expense" as const,
      occurred_on: "2026-08-26",
      description: `내역 ${index + 1}`,
      amount: "1000",
      memo: null,
      created_by: index === 0 ? "user-2" : "user-1",
      created_at: `2026-08-26T01:02:${String(index).padStart(2, "0")}.000Z`,
      category: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "식비",
        color: "#F97316",
        type: "expense" as const,
      },
    }));

    const page = toTransactionPage(rows, {
      currentUserId: "user-1",
      ownerId: "owner-1",
      creatorNames: new Map([["user-1", "권혁"], ["user-2", "민지"]]),
    });
    expect(page.items).toHaveLength(50);
    expect(page.items.at(-1)?.description).toBe("내역 50");
    expect(page.nextCursor).not.toBeNull();
    expect(page.items[0]).toMatchObject({
      createdBy: { id: "user-2", name: "민지" },
      canManage: false,
    });
    expect(page.items[1]).toMatchObject({
      createdBy: { id: "user-1", name: "권혁" },
      canManage: true,
    });
  });

  it("lets the ledger owner manage another member's transaction", () => {
    const row = {
      id: "33333333-3333-4333-8333-333333333333",
      type: "expense" as const,
      occurred_on: "2026-08-26",
      description: "공동 장보기",
      amount: 10000,
      memo: null,
      created_by: "user-2",
      created_at: "2026-08-26T01:00:00.000Z",
      category: { id: "category-1", name: "식비", color: "#F97316", type: "expense" as const },
    };

    const page = toTransactionPage([row], {
      currentUserId: "owner-1",
      ownerId: "owner-1",
      creatorNames: new Map([["user-2", "민지"]]),
    });

    expect(page.items[0].canManage).toBe(true);
  });
});

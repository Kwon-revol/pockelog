import { describe, expect, it, vi } from "vitest";

const serverMocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  resolveTransactionContext: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({ createServerClient: serverMocks.createServerClient }));
vi.mock("@/features/transactions/supabase-gateway", () => ({
  resolveTransactionContext: serverMocks.resolveTransactionContext,
}));

import {
  buildCursorFilter,
  getCreatorProfileSource,
  sanitizeSearchTerm,
  toTransactionPage,
} from "@/features/transactions/query-utils";
import { getLedgerPageData } from "@/features/transactions/queries";

const editorTransactionId = "77777777-7777-4777-8777-777777777777";

function thenableQuery(result: unknown) {
  const response = Promise.resolve(result);
  const query = {
    select: vi.fn(), eq: vi.fn(), gte: vi.fn(), lt: vi.fn(), is: vi.fn(),
    order: vi.fn(), limit: vi.fn(), or: vi.fn(), in: vi.fn(),
    then: response.then.bind(response),
  };
  for (const method of ["select", "eq", "gte", "lt", "is", "order", "limit", "or", "in"] as const) {
    query[method].mockReturnValue(query);
  }
  return query;
}

function ledgerPageClient() {
  const editorRow = {
    id: editorTransactionId,
    type: "expense" as const,
    occurred_on: "2026-08-20",
    description: "세금 화면 연금저축",
    amount: "500000",
    memo: "자동 편집 연결",
    created_by: "user-1",
    created_at: "2026-08-20T01:00:00.000Z",
    category: {
      id: "88888888-8888-4888-8888-888888888888",
      name: "연금저축",
      color: "#10B981",
      type: "expense" as const,
    },
  };
  const ledgerQuery = thenableQuery({
    data: { id: "ledger-1", name: "내 장부", period_start_day: 1, owner_id: "user-1", kind: "personal" },
    error: null,
  });
  Object.assign(ledgerQuery, { maybeSingle: vi.fn().mockResolvedValue({
    data: { id: "ledger-1", name: "내 장부", period_start_day: 1, owner_id: "user-1", kind: "personal" },
    error: null,
  }) });
  const categoriesQuery = thenableQuery({ data: [editorRow.category], error: null });
  const listQuery = thenableQuery({ data: [], error: null });
  const editorQuery = thenableQuery({ data: editorRow, error: null });
  Object.assign(editorQuery, { maybeSingle: vi.fn().mockResolvedValue({ data: editorRow, error: null }) });
  const transactionQueries = [listQuery, editorQuery];

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === "ledgers") return ledgerQuery;
        if (table === "categories") return categoriesQuery;
        if (table === "transactions") return transactionQueries.shift();
        throw new Error(`unexpected table: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({ data: [{ income_total: 0, expense_total: 0, balance: 0 }], error: null }),
    },
    editorQuery: editorQuery as typeof editorQuery & { maybeSingle: ReturnType<typeof vi.fn> },
  };
}

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

  it("loads an active same-ledger editor item from the edit query parameter", async () => {
    const fake = ledgerPageClient();
    serverMocks.createServerClient.mockResolvedValue(fake.client);
    serverMocks.resolveTransactionContext.mockResolvedValue({ userId: "user-1", ledgerId: "ledger-1" });

    const result = await getLedgerPageData(
      { edit: editorTransactionId },
      new Date("2026-08-28T00:00:00+09:00"),
    );

    expect(result.initialEditorItem).toMatchObject({
      id: editorTransactionId,
      description: "세금 화면 연금저축",
      memo: "자동 편집 연결",
      amount: 500000,
      category: { name: "연금저축" },
      canManage: true,
    });
    expect(fake.editorQuery.eq).toHaveBeenCalledWith("id", editorTransactionId);
    expect(fake.editorQuery.eq).toHaveBeenCalledWith("ledger_id", "ledger-1");
    expect(fake.editorQuery.is).toHaveBeenCalledWith("deleted_at", null);
  });
});

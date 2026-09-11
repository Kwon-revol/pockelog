import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

import {
  toCategorySummaries,
  toStatisticsBreakdown,
  toPeriodSummaries,
} from "@/features/statistics/query-utils";
import {
  loadStatisticsDetail,
  loadStatisticsOverview,
  StatisticsAuthenticationError,
  StatisticsQueryError,
  type StatisticsGateway,
} from "@/features/statistics/workflows";
import { createSupabaseStatisticsGateway } from "@/features/statistics/supabase-gateway";
import { statisticsDetailPath } from "@/features/statistics/routing";
import type { LedgerPeriod } from "@/features/transactions/period";
import type { GroupedCategoryStatisticsRow } from "@/features/statistics/types";

const periods: LedgerPeriod[] = [
  { key: "2026-08-10", startOn: "2026-08-10", endOn: "2026-09-09", endExclusive: "2026-09-10" },
  { key: "2026-07-10", startOn: "2026-07-10", endOn: "2026-08-09", endExclusive: "2026-08-10" },
];

const emptyPage = { items: [], nextCursor: null };

function gateway(overrides: Partial<StatisticsGateway> = {}): StatisticsGateway {
  return {
    getContext: async () => ({
      userId: "user-1",
      ledger: { id: "ledger-1", name: "내 장부", periodStartDay: 10 },
    }),
    getPeriodRows: async () => [
      { period_ordinal: 1, start_on: "2026-08-10", end_exclusive: "2026-09-10", income_total: "3000000", expense_total: "800000", balance: "2200000" },
      { period_ordinal: 2, start_on: "2026-07-10", end_exclusive: "2026-08-10", income_total: "0", expense_total: "0", balance: "0" },
    ],
    getCategoryRows: async () => [
      {
        category_id: "food", category_name: "식비", category_color: "#F97316",
        category_sort_order: 1, amount_total: "30000",
        statistics_group_id: null, statistics_group_name: null,
        statistics_group_color: null, statistics_group_sort_order: null,
      },
      {
        category_id: "hobby", category_name: "취미", category_color: "#8B5CF6",
        category_sort_order: 2, amount_total: "10000",
        statistics_group_id: null, statistics_group_name: null,
        statistics_group_color: null, statistics_group_sort_order: null,
      },
    ],
    getTransactionPage: async () => emptyPage,
    ...overrides,
  };
}

describe("statistics query mapping", () => {
  it("preserves the selected type in a detail return path", () => {
    expect(statisticsDetailPath("2026-08-10", "income")).toBe("/statistics/2026-08-10?type=income");
    expect(statisticsDetailPath("2026-08-10", "expense")).toBe("/statistics/2026-08-10");
  });

  it("maps database period rows onto requested periods and fills missing rows", () => {
    expect(toPeriodSummaries([
      { period_ordinal: 1, start_on: "2026-08-10", end_exclusive: "2026-09-10", income_total: "3000000", expense_total: "800000", balance: "2200000" },
    ], periods)).toEqual([
      { ...periods[0], incomeTotal: 3000000, expenseTotal: 800000, balance: 2200000 },
      { ...periods[1], incomeTotal: 0, expenseTotal: 0, balance: 0 },
    ]);
  });

  it("calculates category ratios and preserves amount then configured ordering", () => {
    expect(toCategorySummaries([
      { category_id: "hobby", category_name: "취미", category_color: "#8B5CF6", sort_order: 2, amount_total: "10000" },
      { category_id: "food", category_name: "식비", category_color: "#F97316", sort_order: 1, amount_total: "30000" },
    ], 40000)).toEqual([
      { categoryId: "food", name: "식비", color: "#F97316", sortOrder: 1, amountTotal: 30000, ratio: 75 },
      { categoryId: "hobby", name: "취미", color: "#8B5CF6", sortOrder: 2, amountTotal: 10000, ratio: 25 },
    ]);
  });

  it("returns zero ratios when the selected type total is zero", () => {
    expect(toCategorySummaries([
      { category_id: "food", category_name: "식비", category_color: "#F97316", sort_order: 1, amount_total: "0" },
    ], 0)[0]?.ratio).toBe(0);
  });

  it("groups assigned categories before ungrouped categories", () => {
    const rows: GroupedCategoryStatisticsRow[] = [
      {
        category_id: "housing", category_name: "주거비", category_color: "#F97316",
        category_sort_order: 1, amount_total: "500000",
        statistics_group_id: "fixed", statistics_group_name: "고정지출",
        statistics_group_color: "#64748B", statistics_group_sort_order: 0,
      },
      {
        category_id: "phone", category_name: "통신비", category_color: "#3B82F6",
        category_sort_order: 2, amount_total: "100000",
        statistics_group_id: "fixed", statistics_group_name: "고정지출",
        statistics_group_color: "#64748B", statistics_group_sort_order: 0,
      },
      {
        category_id: "food", category_name: "식비", category_color: "#F97316",
        category_sort_order: 0, amount_total: "200000",
        statistics_group_id: null, statistics_group_name: null,
        statistics_group_color: null, statistics_group_sort_order: null,
      },
    ];

    expect(toStatisticsBreakdown(rows, 800000)).toEqual([
      {
        kind: "group", groupId: "fixed", name: "고정지출", color: "#64748B",
        sortOrder: 0, amountTotal: 600000, ratio: 75,
        categories: [
          { categoryId: "housing", name: "주거비", color: "#F97316", sortOrder: 1, amountTotal: 500000, ratio: 62.5 },
          { categoryId: "phone", name: "통신비", color: "#3B82F6", sortOrder: 2, amountTotal: 100000, ratio: 12.5 },
        ],
      },
      {
        kind: "category",
        category: { categoryId: "food", name: "식비", color: "#F97316", sortOrder: 0, amountTotal: 200000, ratio: 25 },
      },
    ]);
  });

  it("orders groups by configured order, total amount, then group id", () => {
    const rows: GroupedCategoryStatisticsRow[] = [
      {
        category_id: "higher", category_name: "상위", category_color: "#F97316",
        category_sort_order: 0, amount_total: "200",
        statistics_group_id: "z-group", statistics_group_name: "Z 그룹",
        statistics_group_color: "#F97316", statistics_group_sort_order: 1,
      },
      {
        category_id: "lower", category_name: "하위", category_color: "#3B82F6",
        category_sort_order: 0, amount_total: "100",
        statistics_group_id: "a-group", statistics_group_name: "A 그룹",
        statistics_group_color: "#3B82F6", statistics_group_sort_order: 1,
      },
      {
        category_id: "first", category_name: "첫째", category_color: "#10B981",
        category_sort_order: 0, amount_total: "100",
        statistics_group_id: "first-group", statistics_group_name: "첫 그룹",
        statistics_group_color: "#10B981", statistics_group_sort_order: 0,
      },
      {
        category_id: "same", category_name: "동일", category_color: "#8B5CF6",
        category_sort_order: 0, amount_total: "100",
        statistics_group_id: "b-group", statistics_group_name: "B 그룹",
        statistics_group_color: "#8B5CF6", statistics_group_sort_order: 1,
      },
    ];

    expect(toStatisticsBreakdown(rows, 500).map((item) => (
      item.kind === "group" ? item.groupId : item.category.categoryId
    ))).toEqual(["first-group", "z-group", "a-group", "b-group"]);
  });

  it("keeps ungrouped categories in the existing category summary order", () => {
    const rows: GroupedCategoryStatisticsRow[] = [
      {
        category_id: "hobby", category_name: "취미", category_color: "#8B5CF6",
        category_sort_order: 2, amount_total: "10000",
        statistics_group_id: null, statistics_group_name: null,
        statistics_group_color: null, statistics_group_sort_order: null,
      },
      {
        category_id: "food", category_name: "식비", category_color: "#F97316",
        category_sort_order: 1, amount_total: "30000",
        statistics_group_id: null, statistics_group_name: null,
        statistics_group_color: null, statistics_group_sort_order: null,
      },
    ];

    expect(toStatisticsBreakdown(rows, 40000)).toEqual([
      {
        kind: "category",
        category: { categoryId: "food", name: "식비", color: "#F97316", sortOrder: 1, amountTotal: 30000, ratio: 75 },
      },
      {
        kind: "category",
        category: { categoryId: "hobby", name: "취미", color: "#8B5CF6", sortOrder: 2, amountTotal: 10000, ratio: 25 },
      },
    ]);
  });

  it("returns zero ratios for groups and categories when the type total is zero", () => {
    const rows: GroupedCategoryStatisticsRow[] = [
      {
        category_id: "food", category_name: "식비", category_color: "#F97316",
        category_sort_order: 1, amount_total: "10000",
        statistics_group_id: "variable", statistics_group_name: "변동지출",
        statistics_group_color: "#F97316", statistics_group_sort_order: 1,
      },
    ];

    expect(toStatisticsBreakdown(rows, 0)).toEqual([
      {
        kind: "group", groupId: "variable", name: "변동지출", color: "#F97316",
        sortOrder: 1, amountTotal: 10000, ratio: 0,
        categories: [
          { categoryId: "food", name: "식비", color: "#F97316", sortOrder: 1, amountTotal: 10000, ratio: 0 },
        ],
      },
    ]);
  });

  it("rejects grouped category amounts outside the safe integer range", () => {
    const rows: GroupedCategoryStatisticsRow[] = [
      {
        category_id: "food", category_name: "식비", category_color: "#F97316",
        category_sort_order: 1, amount_total: "9007199254740992",
        statistics_group_id: null, statistics_group_name: null,
        statistics_group_color: null, statistics_group_sort_order: null,
      },
    ];

    expect(() => toStatisticsBreakdown(rows, 9007199254740992)).toThrow("statistics amount is not a safe integer");
  });
});

describe("Supabase statistics category query", () => {
  const expectedArgs = {
    target_ledger_id: "ledger-1",
    start_on: "2026-08-10",
    end_exclusive: "2026-09-10",
    target_type: "expense",
  };

  beforeEach(() => {
    mocks.createServerClient.mockReset();
  });

  it("queries grouped category statistics first", async () => {
    const groupedRows: GroupedCategoryStatisticsRow[] = [{
      category_id: "housing", category_name: "주거비", category_color: "#F97316",
      category_sort_order: 1, amount_total: "500000",
      statistics_group_id: "fixed", statistics_group_name: "고정지출",
      statistics_group_color: "#64748B", statistics_group_sort_order: 0,
    }];
    const rpc = vi.fn().mockResolvedValue({ data: groupedRows, error: null });
    mocks.createServerClient.mockResolvedValue({ rpc });
    const supabaseGateway = await createSupabaseStatisticsGateway();

    await expect(supabaseGateway.getCategoryRows("ledger-1", periods[0], "expense"))
      .resolves.toEqual(groupedRows);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_grouped_category_statistics", expectedArgs);
  });

  it.each(["PGRST202", "42883"])(
    "falls back to legacy category statistics only when the grouped RPC is missing (%s)",
    async (code) => {
      const legacyRows = [{
        category_id: "food",
        category_name: "식비",
        category_color: "#F97316",
        sort_order: 1,
        amount_total: "30000",
      }];
      const rpc = vi.fn()
        .mockResolvedValueOnce({ data: null, error: { code, message: "missing function" } })
        .mockResolvedValueOnce({ data: legacyRows, error: null });
      mocks.createServerClient.mockResolvedValue({ rpc });
      const supabaseGateway = await createSupabaseStatisticsGateway();

      await expect(supabaseGateway.getCategoryRows("ledger-1", periods[0], "expense"))
        .resolves.toEqual([{
          category_id: "food",
          category_name: "식비",
          category_color: "#F97316",
          category_sort_order: 1,
          amount_total: "30000",
          statistics_group_id: null,
          statistics_group_name: null,
          statistics_group_color: null,
          statistics_group_sort_order: null,
        }]);
      expect(rpc).toHaveBeenNthCalledWith(1, "get_grouped_category_statistics", expectedArgs);
      expect(rpc).toHaveBeenNthCalledWith(2, "get_category_statistics", expectedArgs);
    },
  );

  it.each([
    ["permission", { code: "42501", message: "permission denied" }],
    ["other schema", { code: "PGRST205", message: "schema cache miss" }],
  ])("does not fall back after a %s error", async (_label, queryError) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: queryError });
    mocks.createServerClient.mockResolvedValue({ rpc });
    const supabaseGateway = await createSupabaseStatisticsGateway();

    await expect(supabaseGateway.getCategoryRows("ledger-1", periods[0], "expense"))
      .rejects.toBeInstanceOf(StatisticsQueryError);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("wraps a network rejection without falling back", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("network request failed"));
    mocks.createServerClient.mockResolvedValue({ rpc });
    const supabaseGateway = await createSupabaseStatisticsGateway();

    await expect(supabaseGateway.getCategoryRows("ledger-1", periods[0], "expense"))
      .rejects.toBeInstanceOf(StatisticsQueryError);
    expect(rpc).toHaveBeenCalledOnce();
  });
});

describe("statistics loading workflows", () => {
  it("loads the latest twelve periods", async () => {
    const result = await loadStatisticsOverview(
      new Date("2026-08-26T12:00:00+09:00"),
      gateway(),
    );
    expect(result.periods).toHaveLength(12);
    expect(result.periods[0]).toMatchObject({ startOn: "2026-08-10", incomeTotal: 3000000 });
  });

  it("loads expense detail by default with matching source transactions", async () => {
    const result = await loadStatisticsDetail("2026-08-10", "invalid", gateway());
    expect(result.type).toBe("expense");
    expect(result.typeTotal).toBe(800000);
    expect(result.breakdown[0]).toMatchObject({
      kind: "category",
      category: { name: "식비", ratio: 3.75 },
    });
    expect(result).not.toHaveProperty("categories");
    expect(result.filters).toMatchObject({ startOn: "2026-08-10", endExclusive: "2026-09-10", type: "expense" });
  });

  it("rejects a period key that does not match the ledger start day", async () => {
    await expect(loadStatisticsDetail("2026-08-09", "expense", gateway())).rejects.toBeInstanceOf(StatisticsQueryError);
  });

  it("distinguishes a signed-out user from a failed query", async () => {
    await expect(loadStatisticsOverview(new Date(), gateway({ getContext: async () => null })))
      .rejects.toBeInstanceOf(StatisticsAuthenticationError);
    await expect(loadStatisticsOverview(new Date(), gateway({ getPeriodRows: async () => { throw new Error("db"); } })))
      .rejects.toBeInstanceOf(StatisticsQueryError);
  });
});

import { describe, expect, it } from "vitest";

import {
  toCategorySummaries,
  toPeriodSummaries,
} from "@/features/statistics/query-utils";
import {
  loadStatisticsDetail,
  loadStatisticsOverview,
  StatisticsAuthenticationError,
  StatisticsQueryError,
  type StatisticsGateway,
} from "@/features/statistics/workflows";
import type { LedgerPeriod } from "@/features/transactions/period";

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
      { category_id: "food", category_name: "식비", category_color: "#F97316", sort_order: 1, amount_total: "30000" },
      { category_id: "hobby", category_name: "취미", category_color: "#8B5CF6", sort_order: 2, amount_total: "10000" },
    ],
    getTransactionPage: async () => emptyPage,
    ...overrides,
  };
}

describe("statistics query mapping", () => {
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
    expect(result.categories[0]).toMatchObject({ name: "식비", ratio: 3.75 });
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

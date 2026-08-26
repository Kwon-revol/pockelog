import type {
  CategorySummary,
  PeriodSummary,
} from "@/features/statistics/types";
import type { LedgerPeriod } from "@/features/transactions/period";

export type PeriodStatisticsRow = {
  period_ordinal: number | string;
  start_on: string;
  end_exclusive: string;
  income_total: number | string;
  expense_total: number | string;
  balance: number | string;
};

export type CategoryStatisticsRow = {
  category_id: string;
  category_name: string;
  category_color: string;
  sort_order: number;
  amount_total: number | string;
};

function money(value: number | string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("statistics amount is not a safe integer");
  return parsed;
}

export function toPeriodSummaries(
  rows: PeriodStatisticsRow[],
  periods: LedgerPeriod[],
): PeriodSummary[] {
  const byOrdinal = new Map(rows.map((row) => [Number(row.period_ordinal), row]));
  return periods.map((period, index) => {
    const row = byOrdinal.get(index + 1);
    return {
      ...period,
      incomeTotal: row ? money(row.income_total) : 0,
      expenseTotal: row ? money(row.expense_total) : 0,
      balance: row ? money(row.balance) : 0,
    };
  });
}

export function toCategorySummaries(
  rows: CategoryStatisticsRow[],
  typeTotal: number,
): CategorySummary[] {
  return rows
    .map((row) => {
      const amountTotal = money(row.amount_total);
      return {
        categoryId: row.category_id,
        name: row.category_name,
        color: row.category_color,
        sortOrder: row.sort_order,
        amountTotal,
        ratio: typeTotal > 0 ? (amountTotal / typeTotal) * 100 : 0,
      };
    })
    .sort((left, right) =>
      right.amountTotal - left.amountTotal
      || left.sortOrder - right.sortOrder
      || left.categoryId.localeCompare(right.categoryId),
    );
}

import type {
  CategorySummary,
  GroupedCategoryStatisticsRow,
  PeriodSummary,
  StatisticsBreakdownItem,
  StatisticsGroupSummary,
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

function toCategoryRow(row: GroupedCategoryStatisticsRow): CategoryStatisticsRow {
  return {
    category_id: row.category_id,
    category_name: row.category_name,
    category_color: row.category_color,
    sort_order: row.category_sort_order,
    amount_total: row.amount_total,
  };
}

export function toStatisticsBreakdown(
  rows: GroupedCategoryStatisticsRow[],
  typeTotal: number,
): StatisticsBreakdownItem[] {
  const groupedRows = new Map<string, GroupedCategoryStatisticsRow[]>();
  const ungroupedRows: CategoryStatisticsRow[] = [];

  for (const row of rows) {
    if (row.statistics_group_id) {
      const groupRows = groupedRows.get(row.statistics_group_id) ?? [];
      groupRows.push(row);
      groupedRows.set(row.statistics_group_id, groupRows);
    } else {
      ungroupedRows.push(toCategoryRow(row));
    }
  }

  const groups: StatisticsGroupSummary[] = [...groupedRows.entries()].map(([groupId, groupRows]) => {
    const firstRow = groupRows[0];
    const categories = toCategorySummaries(groupRows.map(toCategoryRow), typeTotal);
    const amountTotal = money(categories.reduce((total, category) => total + category.amountTotal, 0));
    return {
      kind: "group",
      groupId,
      name: firstRow.statistics_group_name ?? "",
      color: firstRow.statistics_group_color ?? "",
      sortOrder: firstRow.statistics_group_sort_order ?? 0,
      amountTotal,
      ratio: typeTotal > 0 ? (amountTotal / typeTotal) * 100 : 0,
      categories,
    };
  });

  groups.sort((left, right) => (
    left.sortOrder - right.sortOrder
    || right.amountTotal - left.amountTotal
    || left.groupId.localeCompare(right.groupId)
  ));

  return [
    ...groups,
    ...toCategorySummaries(ungroupedRows, typeTotal).map((category) => ({ kind: "category" as const, category })),
  ];
}

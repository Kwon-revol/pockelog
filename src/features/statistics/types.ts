import type { LedgerPeriod } from "@/features/transactions/period";
import type {
  DailyBalance,
  TransactionFilters,
  TransactionPage,
  TransactionType,
} from "@/features/transactions/types";

export type PeriodSummary = LedgerPeriod & {
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
};

export type CategorySummary = {
  categoryId: string;
  name: string;
  color: string;
  amountTotal: number;
  ratio: number;
  sortOrder: number;
};

export type GroupedCategoryStatisticsRow = {
  category_id: string;
  category_name: string;
  category_color: string;
  category_sort_order: number;
  amount_total: number | string;
  statistics_group_id: string | null;
  statistics_group_name: string | null;
  statistics_group_color: string | null;
  statistics_group_sort_order: number | null;
};

export type StatisticsGroupSummary = {
  kind: "group";
  groupId: string;
  name: string;
  color: string;
  sortOrder: number;
  amountTotal: number;
  ratio: number;
  categories: CategorySummary[];
};

export type StatisticsBreakdownItem =
  | StatisticsGroupSummary
  | { kind: "category"; category: CategorySummary };

export type StatisticsOverviewData = {
  ledger: { id: string; name: string; periodStartDay: number | null };
  periods: PeriodSummary[];
};

export type StatisticsDetailData = {
  ledger: { id: string; name: string; periodStartDay: number | null };
  period: PeriodSummary;
  type: TransactionType;
  breakdown: StatisticsBreakdownItem[];
  typeTotal: number;
  filters: TransactionFilters;
  page: TransactionPage;
  dailyBalances: DailyBalance[];
};

import type { LedgerPeriod } from "@/features/transactions/period";
import type {
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

export type StatisticsOverviewData = {
  ledger: { id: string; name: string; periodStartDay: number | null };
  periods: PeriodSummary[];
};

export type StatisticsDetailData = {
  ledger: { id: string; name: string; periodStartDay: number | null };
  period: PeriodSummary;
  type: TransactionType;
  categories: CategorySummary[];
  typeTotal: number;
  filters: TransactionFilters;
  page: TransactionPage;
};

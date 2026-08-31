import type { TaxCategoryCode } from "@/features/tax/types";

export type TransactionType = "income" | "expense";
export type TransactionSort = "newest" | "oldest";

export type CategoryOption = {
  id: string;
  name: string;
  color: string;
  type: TransactionType;
  systemCode: TaxCategoryCode | null;
};

export type TransactionCursor = {
  occurredOn: string;
  createdAt: string;
  id: string;
};

export type TransactionFilters = {
  startOn: string;
  endOn: string;
  endExclusive: string;
  query: string;
  type: TransactionType | "all";
  categoryId: string | null;
  sort: TransactionSort;
};

export type TransactionInput = {
  type: TransactionType;
  occurredOn: string;
  description: string;
  amount: number;
  categoryId: string;
  memo: string;
  idempotencyKey?: string;
};

export type TransactionListItem = {
  id: string;
  type: TransactionType;
  occurredOn: string;
  description: string;
  amount: number;
  memo: string;
  category: CategoryOption;
  createdBy: { id: string; name: string };
  canManage: boolean;
  createdAt: string;
};

export type TransactionPage = {
  items: TransactionListItem[];
  nextCursor: string | null;
};

export type TransactionSummary = {
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
};

export type LedgerPageData = {
  ledger: { id: string; name: string; periodStartDay: number | null; kind: "personal" | "shared" };
  categories: CategoryOption[];
  filters: TransactionFilters;
  page: TransactionPage;
  summary: TransactionSummary;
  initialEditorItem: TransactionListItem | null;
  initialCategoryId: string | null;
};

export type TransactionActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialTransactionActionState: TransactionActionState = {
  status: "idle",
};

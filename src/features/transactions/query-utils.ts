import { encodeCursor } from "@/features/transactions/cursor";
import type {
  CategoryOption,
  TransactionCursor,
  TransactionPage,
  TransactionSort,
  TransactionType,
} from "@/features/transactions/types";

export type TransactionRow = {
  id: string;
  type: TransactionType;
  occurred_on: string;
  description: string;
  amount: string | number;
  memo: string | null;
  created_at: string;
  category: CategoryOption | CategoryOption[];
};

export function buildCursorFilter(cursor: TransactionCursor, sort: TransactionSort) {
  const operator = sort === "newest" ? "lt" : "gt";
  return [
    `occurred_on.${operator}.${cursor.occurredOn}`,
    `and(occurred_on.eq.${cursor.occurredOn},created_at.${operator}.${cursor.createdAt})`,
    `and(occurred_on.eq.${cursor.occurredOn},created_at.eq.${cursor.createdAt},id.${operator}.${cursor.id})`,
  ].join(",");
}

export function sanitizeSearchTerm(value: string) {
  return value.replace(/[(),]/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function toTransactionPage(rows: TransactionRow[]): TransactionPage {
  const hasNext = rows.length > 50;
  const visible = rows.slice(0, 50);
  const items = visible.map((row) => ({
    id: row.id,
    type: row.type,
    occurredOn: row.occurred_on,
    description: row.description,
    amount: Number(row.amount),
    memo: row.memo ?? "",
    category: Array.isArray(row.category) ? row.category[0] : row.category,
    createdAt: row.created_at,
  }));
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasNext && last
      ? encodeCursor({ occurredOn: last.occurredOn, createdAt: last.createdAt, id: last.id })
      : null,
  };
}

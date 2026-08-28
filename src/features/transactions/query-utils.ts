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
  created_by: string;
  created_at: string;
  category: CategoryOption | CategoryOption[];
};

export function getCreatorProfileSource(kind: "personal" | "shared") {
  return kind === "shared" ? "rpc" : "profiles";
}

type TransactionViewer = {
  currentUserId: string;
  ownerId: string;
  creatorNames: Map<string, string>;
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

export function toTransactionPage(rows: TransactionRow[], viewer: TransactionViewer): TransactionPage {
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
    createdBy: {
      id: row.created_by,
      name: viewer.creatorNames.get(row.created_by) ?? "알 수 없는 사용자",
    },
    canManage: viewer.currentUserId === viewer.ownerId || viewer.currentUserId === row.created_by,
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

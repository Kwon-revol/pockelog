import type { TransactionType } from "@/features/transactions/types";

export type TrashItem = {
  id: string;
  type: TransactionType;
  occurredOn: string;
  description: string;
  amount: number;
  memo: string;
  category: { name: string; color: string };
  createdBy: { id: string; name: string };
  deletedAt: string;
};

export type TrashPage = { items: TrashItem[]; nextCursor: string | null };
export type TrashMutationResult = "restored" | "deleted" | "missing" | "forbidden" | "error";
export type TrashActionState = { status: "success" | "error"; message: string };

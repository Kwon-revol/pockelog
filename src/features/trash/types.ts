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
export const TRASH_LOGIN_PATH = "/login?next=%2Fsettings%2Ftrash";
export type TrashMutationResult =
  | "restored"
  | "deleted"
  | "missing"
  | "unauthenticated"
  | "forbidden"
  | "error";
export type TrashActionState = {
  status: "success" | "error" | "unauthenticated";
  message: string;
};

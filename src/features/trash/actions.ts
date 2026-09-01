"use server";

import { revalidatePath } from "next/cache";

import { trashTransactionIdSchema } from "@/features/trash/schemas";
import { createSupabaseTrashGateway } from "@/features/trash/supabase-gateway";
import type { TrashActionState } from "@/features/trash/types";
import {
  permanentlyDeleteTransaction,
  restoreDeletedTransaction,
  type TrashMutationGateway,
} from "@/features/trash/workflows";

const affectedPaths = ["/settings/trash", "/ledger", "/statistics", "/tax-goals"];

function invalidTransactionState(): TrashActionState {
  return { status: "error", message: "이 내역을 변경할 수 없습니다." };
}

function revalidateTrashConsumers() {
  for (const path of affectedPaths) revalidatePath(path);
}

export async function restoreDeletedTransactionAction(id: string): Promise<TrashActionState> {
  const parsed = trashTransactionIdSchema.safeParse(id);
  if (!parsed.success) return invalidTransactionState();

  let gateway: TrashMutationGateway;
  try {
    gateway = await createSupabaseTrashGateway();
  } catch {
    return { status: "error", message: "복원하지 못했습니다. 다시 시도해 주세요." };
  }
  const result = await restoreDeletedTransaction(
    parsed.data,
    gateway,
  );
  if (result.status === "success") revalidateTrashConsumers();
  return result;
}

export async function permanentlyDeleteTransactionAction(
  id: string,
): Promise<TrashActionState> {
  const parsed = trashTransactionIdSchema.safeParse(id);
  if (!parsed.success) return invalidTransactionState();

  let gateway: TrashMutationGateway;
  try {
    gateway = await createSupabaseTrashGateway();
  } catch {
    return {
      status: "error",
      message: "영구 삭제하지 못했습니다. 다시 시도해 주세요.",
    };
  }
  const result = await permanentlyDeleteTransaction(
    parsed.data,
    gateway,
  );
  if (result.status === "success") revalidateTrashConsumers();
  return result;
}

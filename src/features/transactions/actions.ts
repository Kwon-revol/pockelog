"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { formDataToTransactionInput } from "@/features/transactions/schemas";
import { createSupabaseTransactionGateway } from "@/features/transactions/supabase-gateway";
import type { TransactionActionState } from "@/features/transactions/types";
import {
  createTransaction,
  trashTransaction,
  updateTransaction,
} from "@/features/transactions/workflows";

function invalidFormState(
  result: Extract<ReturnType<typeof formDataToTransactionInput>, { success: false }>,
): TransactionActionState {
  return {
    status: "error",
    message: "입력한 내용을 확인해 주세요.",
    fieldErrors: result.error.flatten().fieldErrors,
  };
}

export async function createTransactionAction(
  _previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const parsed = formDataToTransactionInput(formData);
  if (!parsed.success) return invalidFormState(parsed);
  const gateway = await createSupabaseTransactionGateway();
  const result = await createTransaction(parsed.data, gateway);
  if (result.status === "success") {
    revalidatePath("/ledger");
    if (formData.get("pensionContributionPreset") === "1") redirect("/ledger");
  }
  return result;
}

export async function updateTransactionAction(
  transactionId: string,
  _previousState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const parsed = formDataToTransactionInput(formData);
  if (!parsed.success) return invalidFormState(parsed);
  const gateway = await createSupabaseTransactionGateway();
  const result = await updateTransaction(transactionId, parsed.data, gateway);
  if (result.status === "success") revalidatePath("/ledger");
  return result;
}

export async function trashTransactionAction(transactionId: string) {
  const gateway = await createSupabaseTransactionGateway();
  const result = await trashTransaction(transactionId, gateway);
  if (result.status === "success") revalidatePath("/ledger");
  return result;
}

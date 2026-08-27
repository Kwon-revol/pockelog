"use server";

import { revalidatePath } from "next/cache";

import {
  formDataToCategoryInput,
  formDataToLedgerSettingsInput,
} from "@/features/settings/schemas";
import { createSupabaseSettingsGateway } from "@/features/settings/supabase-gateway";
import type { SettingsActionState } from "@/features/settings/types";
import {
  createCategory,
  moveCategory,
  setCategoryActive,
  updateCategory,
  updateLedgerSettings,
} from "@/features/settings/workflows";
import type { TransactionType } from "@/features/transactions/types";

function invalidState(
  result: { error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } } },
): SettingsActionState {
  return {
    status: "error",
    message: "입력한 내용을 확인해 주세요.",
    fieldErrors: result.error.flatten().fieldErrors,
  };
}

function revalidateSettingsConsumers() {
  revalidatePath("/settings");
  revalidatePath("/ledger");
  revalidatePath("/statistics");
}

export async function updateLedgerSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = formDataToLedgerSettingsInput(formData);
  if (!parsed.success) return invalidState(parsed);
  const result = await updateLedgerSettings(parsed.data, await createSupabaseSettingsGateway());
  if (result.status === "success") revalidateSettingsConsumers();
  return result;
}

export async function createCategoryAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = formDataToCategoryInput(formData);
  if (!parsed.success) return invalidState(parsed);
  const result = await createCategory(parsed.data, await createSupabaseSettingsGateway());
  if (result.status === "success") revalidateSettingsConsumers();
  return result;
}

export async function updateCategoryAction(
  categoryId: string,
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const parsed = formDataToCategoryInput(formData);
  if (!parsed.success) return invalidState(parsed);
  const result = await updateCategory(categoryId, parsed.data, await createSupabaseSettingsGateway());
  if (result.status === "success") revalidateSettingsConsumers();
  return result;
}

export async function setCategoryActiveAction(categoryId: string, active: boolean) {
  const result = await setCategoryActive(categoryId, active, await createSupabaseSettingsGateway());
  if (result.status === "success") revalidateSettingsConsumers();
  return result;
}

export async function moveCategoryAction(
  categoryId: string,
  direction: "up" | "down",
  type: TransactionType,
  orderedIds: string[],
) {
  const result = await moveCategory(
    categoryId,
    direction,
    type,
    orderedIds,
    await createSupabaseSettingsGateway(),
  );
  if (result.status === "success") revalidateSettingsConsumers();
  return result;
}

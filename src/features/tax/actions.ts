"use server";

import { revalidatePath } from "next/cache";

import { taxProfileFormSchema } from "@/features/tax/schemas";
import { createSupabaseTaxGateway } from "@/features/tax/supabase-gateway";
import {
  saveTaxProfile,
  type TaxActionState,
} from "@/features/tax/workflows";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function invalidFormState(
  result: Extract<ReturnType<typeof taxProfileFormSchema.safeParse>, { success: false }>,
): TaxActionState {
  return {
    status: "error",
    message: "입력한 내용을 확인해 주세요.",
    fieldErrors: result.error.flatten().fieldErrors,
  };
}

export async function saveTaxProfileAction(
  _previousState: TaxActionState,
  formData: FormData,
): Promise<TaxActionState> {
  const parsed = taxProfileFormSchema.safeParse({
    taxYear: formValue(formData, "taxYear"),
    grossSalary: formValue(formData, "grossSalary"),
  });
  if (!parsed.success) return invalidFormState(parsed);
  if (parsed.data.taxYear !== 2026) return { status: "error", message: "입력한 내용을 확인해 주세요." };

  const result = await saveTaxProfile(await createSupabaseTaxGateway(), {
    taxYear: 2026,
    grossSalary: parsed.data.grossSalary,
  });
  if (result.status === "success") revalidatePath("/tax-goals");
  return result;
}

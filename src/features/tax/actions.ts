"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { transactionIdSchema } from "@/features/transactions/schemas";
import { taxProfileFormSchema } from "@/features/tax/schemas";
import { createSupabaseTaxGateway } from "@/features/tax/supabase-gateway";
import {
  saveTaxProfile,
  type TaxActionState,
} from "@/features/tax/workflows";
import { createServerClient } from "@/shared/supabase/server";

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

  const result = await saveTaxProfile(await createSupabaseTaxGateway(), {
    taxYear: parsed.data.taxYear,
    grossSalary: parsed.data.grossSalary,
  });
  if (result.status === "success") revalidatePath("/tax-goals");
  return result;
}

export async function openTaxContributionAction(
  transactionId: string,
): Promise<TaxActionState> {
  if (!transactionIdSchema.safeParse(transactionId).success) {
    return { status: "error", message: "이 납입 내역을 편집할 수 없습니다." };
  }

  let destination: string | null = null;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: "error", message: "로그인이 필요합니다." };

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("id,ledger_id,created_by")
      .eq("id", transactionId)
      .eq("created_by", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (transactionError || !transaction) {
      return { status: "error", message: "이 납입 내역을 편집할 수 없습니다." };
    }

    const { data: membership, error: membershipError } = await supabase
      .from("ledger_members")
      .select("ledger_id")
      .eq("ledger_id", transaction.ledger_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError || !membership) {
      return { status: "error", message: "이 납입 내역을 편집할 수 없습니다." };
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("user_private_profiles")
      .update({ default_ledger_id: transaction.ledger_id })
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();
    if (updateError || !updatedProfile) {
      return { status: "error", message: "이 납입 내역을 편집할 수 없습니다." };
    }
    destination = `/ledger?edit=${transaction.id}`;
  } catch {
    return { status: "error", message: "이 납입 내역을 편집할 수 없습니다." };
  }

  redirect(destination);
}

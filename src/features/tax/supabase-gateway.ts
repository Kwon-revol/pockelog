import "server-only";

import type { TaxGateway } from "@/features/tax/workflows";
import { createServerClient } from "@/shared/supabase/server";

export async function createSupabaseTaxGateway(): Promise<TaxGateway> {
  const supabase = await createServerClient();

  return {
    async getSessionUserId() {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },

    async upsertProfile(userId, input) {
      const { error } = await supabase.from("user_tax_profiles").upsert({
        user_id: userId,
        tax_year: input.taxYear,
        income_type: "employment",
        gross_salary: input.grossSalary,
      }, { onConflict: "user_id,tax_year" });
      if (!error) return "saved";
      return error.code === "42501" ? "forbidden" : "error";
    },
  };
}

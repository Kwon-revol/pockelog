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

    async upsertProfile(_userId, input) {
      const { error } = await supabase.rpc("upsert_my_tax_profile", {
        target_year: input.taxYear,
        target_gross_salary: input.grossSalary,
      });
      if (!error) return "saved";
      return error.code === "42501" ? "forbidden" : "error";
    },
  };
}

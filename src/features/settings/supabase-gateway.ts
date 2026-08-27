import "server-only";

import type { SettingsGateway } from "@/features/settings/workflows";
import { resolveTransactionContext } from "@/features/transactions/supabase-gateway";
import { createServerClient } from "@/shared/supabase/server";

export async function createSupabaseSettingsGateway(): Promise<SettingsGateway> {
  const supabase = await createServerClient();

  return {
    async getContext() {
      const context = await resolveTransactionContext(supabase);
      if (!context) return null;
      const { data, error } = await supabase
        .from("ledger_members")
        .select("role")
        .eq("ledger_id", context.ledgerId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (error || !data) throw new Error("settings context unavailable");
      return { ...context, isOwner: data.role === "owner" };
    },

    async updateLedger(context, input) {
      const { data, error } = await supabase
        .from("ledgers")
        .update({ name: input.name, period_start_day: input.periodStartDay })
        .eq("id", context.ledgerId)
        .select("id")
        .maybeSingle();
      return !error && data ? "updated" : error?.code === "42501" ? "forbidden" : "error";
    },

    async createCategory(context, input) {
      const { data: last } = await supabase
        .from("categories")
        .select("sort_order")
        .eq("ledger_id", context.ledgerId)
        .eq("type", input.type)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from("categories").insert({
        ledger_id: context.ledgerId,
        type: input.type,
        name: input.name,
        color: input.color,
        sort_order: (last?.sort_order ?? -1) + 1,
      });
      if (!error) return "created";
      if (error.code === "23505") return "duplicate";
      return error.code === "42501" ? "forbidden" : "error";
    },

    async updateCategory(context, id, input) {
      const { data, error } = await supabase
        .from("categories")
        .update({ name: input.name, color: input.color })
        .eq("id", id)
        .eq("ledger_id", context.ledgerId)
        .eq("type", input.type)
        .select("id")
        .maybeSingle();
      if (!error && data) return "updated";
      if (error?.code === "23505") return "duplicate";
      return error?.code === "42501" || !data ? "forbidden" : "error";
    },

    async setCategoryActive(context, id, active) {
      const { data, error } = await supabase
        .from("categories")
        .update({ is_active: active })
        .eq("id", id)
        .eq("ledger_id", context.ledgerId)
        .select("id")
        .maybeSingle();
      return !error && data ? "updated" : error?.code === "500" ? "error" : "forbidden";
    },

    async setCategoryOrder(context, type, orderedIds) {
      const { error } = await supabase.rpc("set_category_order", {
        target_ledger_id: context.ledgerId,
        target_type: type,
        ordered_ids: orderedIds,
      });
      return !error ? "updated" : error.code === "42501" || error.code === "P0001" ? "forbidden" : "error";
    },
  };
}

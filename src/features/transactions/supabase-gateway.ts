import "server-only";

import { createServerClient } from "@/shared/supabase/server";
import type {
  ChangeResult,
  CreateResult,
  TransactionGateway,
  TransactionSessionContext,
} from "@/features/transactions/workflows";

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

export async function resolveTransactionContext(
  supabase: ServerClient,
): Promise<TransactionSessionContext | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_private_profiles")
    .select("default_ledger_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.default_ledger_id) return null;

  return { userId: user.id, ledgerId: profile.default_ledger_id };
}

export async function createSupabaseTransactionGateway(): Promise<TransactionGateway> {
  const supabase = await createServerClient();

  return {
    async getSessionContext() {
      return resolveTransactionContext(supabase);
    },

    async create(context, input): Promise<CreateResult> {
      const { error } = await supabase.from("transactions").insert({
        ledger_id: context.ledgerId,
        type: input.type,
        occurred_on: input.occurredOn,
        description: input.description,
        amount: input.amount,
        category_id: input.categoryId,
        memo: input.memo || null,
        created_by: context.userId,
        idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
      });
      if (!error) return "created";
      if (error.code === "23505") return "duplicate";
      if (error.code === "42501" || error.code === "P0001") return "forbidden";
      return "error";
    },

    async update(context, id, input): Promise<ChangeResult> {
      const { data, error } = await supabase
        .from("transactions")
        .update({
          type: input.type,
          occurred_on: input.occurredOn,
          description: input.description,
          amount: input.amount,
          category_id: input.categoryId,
          memo: input.memo || null,
        })
        .eq("id", id)
        .eq("ledger_id", context.ledgerId)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      return !error && data ? "updated" : error?.code === "500" ? "error" : "forbidden";
    },

    async trash(context, id): Promise<ChangeResult> {
      const { data, error } = await supabase
        .from("transactions")
        .update({ deleted_at: new Date().toISOString(), deleted_by: context.userId })
        .eq("id", id)
        .eq("ledger_id", context.ledgerId)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      return !error && data ? "trashed" : error?.code === "500" ? "error" : "forbidden";
    },
  };
}

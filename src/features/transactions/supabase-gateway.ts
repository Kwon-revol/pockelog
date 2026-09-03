import "server-only";

import { createAdminClient } from "@/shared/supabase/admin";
import { createServerClient } from "@/shared/supabase/server";
import type {
  ChangeResult,
  CreateResult,
  TransactionGateway,
  TransactionSessionContext,
} from "@/features/transactions/workflows";

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

export class TransactionContextError extends Error {}

function isMissingRpc(error: { code?: string; message?: string } | null) {
  return error?.code === "42883" || /does not exist/i.test(error?.message ?? "");
}

async function trashVisibleTransaction(
  supabase: ServerClient,
  context: TransactionSessionContext,
  id: string,
): Promise<ChangeResult> {
  const existing = await supabase
    .from("transactions")
    .select("id, created_by")
    .eq("id", id)
    .eq("ledger_id", context.ledgerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing.error) return "forbidden";
  if (!existing.data) return "forbidden";

  const { data: ledger, error: ledgerError } = await supabase
    .from("ledgers")
    .select("owner_id")
    .eq("id", context.ledgerId)
    .maybeSingle();
  if (ledgerError || !ledger) return "forbidden";
  if (ledger.owner_id !== context.userId && existing.data.created_by !== context.userId) {
    return "forbidden";
  }

  const { error } = await createAdminClient()
    .from("transactions")
    .update({ deleted_at: new Date().toISOString(), deleted_by: context.userId })
    .eq("id", id)
    .is("deleted_at", null);
  return error ? "error" : "trashed";
}

export async function resolveTransactionContext(
  supabase: ServerClient,
): Promise<TransactionSessionContext | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("user_private_profiles")
    .select("default_ledger_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new TransactionContextError("기본 장부 정보를 조회하지 못했습니다.");
  if (!profile?.default_ledger_id) {
    throw new TransactionContextError("기본 장부가 준비되지 않았습니다.");
  }

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
      const { data, error } = await supabase.rpc("trash_active_transaction", {
        target_transaction_id: id,
      });
      if (!error) return data === "trashed" ? "trashed" : "forbidden";
      if (isMissingRpc(error)) return trashVisibleTransaction(supabase, context, id);
      if (error.code === "28000" || error.code === "42501") return "forbidden";
      return "error";
    },
  };
}

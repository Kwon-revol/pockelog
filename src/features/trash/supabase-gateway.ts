import "server-only";

import type { TrashMutationResult } from "@/features/trash/types";
import type { TrashMutationGateway } from "@/features/trash/workflows";
import { createServerClient } from "@/shared/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;
type TrashMutationRpc = "restore_deleted_transaction" | "permanently_delete_transaction";

async function runMutation(
  supabase: ServerClient,
  rpcName: TrashMutationRpc,
  id: string,
  successResult: "restored" | "deleted",
): Promise<TrashMutationResult> {
  try {
    const { data, error } = await supabase.rpc(rpcName, { target_transaction_id: id });
    if (error) return error.code === "42501" ? "forbidden" : "error";
    if (data === successResult || data === "missing") return data;
    return "error";
  } catch {
    return "error";
  }
}

export async function createSupabaseTrashGateway(): Promise<TrashMutationGateway> {
  const supabase = await createServerClient();

  return {
    restore(id) {
      return runMutation(supabase, "restore_deleted_transaction", id, "restored");
    },
    permanentlyDelete(id) {
      return runMutation(supabase, "permanently_delete_transaction", id, "deleted");
    },
  };
}

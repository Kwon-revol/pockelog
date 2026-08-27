import "server-only";

import { mapLedgerContext, type LedgerMembershipRow } from "@/features/shared-ledgers/query-utils";
import type { AppLedgerContext } from "@/features/ledgers/types";
import { createServerClient } from "@/shared/supabase/server";

export class LedgerContextError extends Error {}

export async function getCurrentAppContext(): Promise<AppLedgerContext | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile, error: profileError }, { data: privateProfile, error: privateError }, membershipResult, invitationResult] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_private_profiles").select("default_ledger_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("ledger_members")
      .select("role,joined_at,ledger:ledgers!inner(id,name,kind)"),
    supabase
      .from("ledger_invitations")
      .select("id", { count: "exact", head: true })
      .eq("target_user_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
  ]);
  if (profileError || privateError || membershipResult.error || invitationResult.error) {
    throw new LedgerContextError("장부 컨텍스트를 불러오지 못했습니다.");
  }

  const context = mapLedgerContext(
    user.id,
    profile?.display_name ?? user.user_metadata.display_name ?? "사용자",
    privateProfile?.default_ledger_id ?? null,
    (membershipResult.data ?? []) as unknown as LedgerMembershipRow[],
    invitationResult.count ?? 0,
  );
  if (!context) throw new LedgerContextError("사용 가능한 장부가 없습니다.");

  if (context.needsDefaultRepair) {
    const { error } = await supabase
      .from("user_private_profiles")
      .update({ default_ledger_id: context.currentLedger.id })
      .eq("user_id", user.id);
    if (error) throw new LedgerContextError("기본 장부를 복구하지 못했습니다.");
  }

  return context;
}

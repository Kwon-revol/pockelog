import "server-only";

import { getCurrentAppContext } from "@/features/ledgers/queries";
import {
  mapInvitations,
  mapMembers,
  type InvitationRow,
  type MemberRow,
} from "@/features/shared-ledgers/query-utils";
import type { SharedLedgerPageData } from "@/features/shared-ledgers/types";
import { createServerClient } from "@/shared/supabase/server";

export class SharedLedgerQueryError extends Error {}

type InvitationQueryRow = Omit<InvitationRow, "ledger_name"> & {
  ledger: { name: string };
};

export async function getSharedLedgerPageData(now = new Date()): Promise<SharedLedgerPageData | null> {
  const context = await getCurrentAppContext();
  if (!context) return null;
  const supabase = await createServerClient();

  const [invitationResult, memberResult] = await Promise.all([
    supabase
      .from("ledger_invitations")
      .select("id,ledger_id,target_user_id,invited_by,status,expires_at,created_at,ledger:ledgers!inner(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("ledger_members")
      .select("user_id,role,joined_at")
      .eq("ledger_id", context.currentLedger.id),
  ]);
  if (invitationResult.error || memberResult.error) {
    throw new SharedLedgerQueryError("공동 장부 정보를 불러오지 못했습니다.");
  }

  const invitationRows = ((invitationResult.data ?? []) as unknown as InvitationQueryRow[]).map((row) => ({
    ...row,
    ledger_name: row.ledger.name,
  }));
  const memberRows = (memberResult.data ?? []) as unknown as MemberRow[];
  const profileIds = [...new Set([
    ...invitationRows.flatMap((row) => [row.target_user_id, row.invited_by]),
    ...memberRows.map((row) => row.user_id),
  ])];
  const profileResult = profileIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", profileIds)
    : { data: [], error: null };
  if (profileResult.error) throw new SharedLedgerQueryError("구성원 이름을 불러오지 못했습니다.");
  const profileNames = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
  const invitations = mapInvitations(invitationRows, profileNames, now);
  const ledgers = context.ledgers.map((ledger) => ({ ...ledger, isCurrent: ledger.id === context.currentLedger.id }));

  return {
    currentLedger: { ...context.currentLedger, isCurrent: true },
    ledgers,
    receivedInvitations: invitations.filter((invitation) => invitation.targetUserId === context.userId),
    sentInvitations: invitations.filter((invitation) => (
      invitation.ledgerId === context.currentLedger.id
      && invitation.targetUserId !== context.userId
    )),
    members: mapMembers(memberRows, profileNames),
  };
}

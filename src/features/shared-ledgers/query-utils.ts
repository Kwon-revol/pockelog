import type { AppLedgerContext } from "@/features/ledgers/types";
import type {
  InvitationStatus,
  LedgerInvitation,
  LedgerMember,
  LedgerMemberRole,
} from "@/features/shared-ledgers/types";

export function isSharedLedgerSchemaMissing(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export type LedgerMembershipRow = {
  role: LedgerMemberRole;
  joined_at: string;
  ledger: { id: string; name: string; kind: "personal" | "shared" };
};

export type InvitationRow = {
  id: string;
  ledger_id: string;
  target_user_id: string;
  invited_by: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  ledger_name: string;
};

export type MemberRow = {
  user_id: string;
  role: LedgerMemberRole;
  joined_at: string;
};

export function mapLedgerContext(
  userId: string,
  userName: string,
  defaultLedgerId: string | null,
  memberships: readonly LedgerMembershipRow[],
  pendingInvitationCount: number,
): AppLedgerContext | null {
  const ledgers = memberships
    .map((membership) => ({
      id: membership.ledger.id,
      name: membership.ledger.name,
      kind: membership.ledger.kind,
      role: membership.role,
    }))
    .sort((left, right) => (
      Number(left.kind === "shared") - Number(right.kind === "shared")
      || left.name.localeCompare(right.name, "ko")
      || left.id.localeCompare(right.id)
    ));
  if (ledgers.length === 0) return null;

  const stored = ledgers.find((ledger) => ledger.id === defaultLedgerId);
  const fallback = ledgers.find((ledger) => ledger.kind === "personal") ?? ledgers[0];
  const currentLedger = stored ?? fallback;

  return {
    userId,
    userName,
    currentLedger,
    ledgers,
    pendingInvitationCount,
    needsDefaultRepair: !stored || defaultLedgerId !== currentLedger.id,
  };
}

export function mapInvitations(
  rows: readonly InvitationRow[],
  profileNames: ReadonlyMap<string, string>,
  now = new Date(),
): LedgerInvitation[] {
  return rows.map((row) => ({
    id: row.id,
    ledgerId: row.ledger_id,
    ledgerName: row.ledger_name,
    targetUserId: row.target_user_id,
    targetName: profileNames.get(row.target_user_id) ?? "알 수 없는 사용자",
    invitedByName: profileNames.get(row.invited_by) ?? "알 수 없는 사용자",
    status: row.status === "pending" && new Date(row.expires_at) <= now ? "expired" : row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export function mapMembers(
  rows: readonly MemberRow[],
  profileNames: ReadonlyMap<string, string>,
): LedgerMember[] {
  return rows
    .map((row) => ({
      userId: row.user_id,
      displayName: profileNames.get(row.user_id) ?? "알 수 없는 사용자",
      role: row.role,
      joinedAt: row.joined_at,
    }))
    .sort((left, right) => (
      Number(left.role === "member") - Number(right.role === "member")
      || left.displayName.localeCompare(right.displayName, "ko")
      || left.userId.localeCompare(right.userId)
    ));
}

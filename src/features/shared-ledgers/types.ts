export type LedgerKind = "personal" | "shared";
export type LedgerMemberRole = "owner" | "member";
export type InvitationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

export type SharedLedgerSummary = {
  id: string;
  name: string;
  kind: LedgerKind;
  role: LedgerMemberRole;
  isCurrent: boolean;
};

export type LedgerInvitation = {
  id: string;
  ledgerId: string;
  ledgerName: string;
  targetUserId: string;
  targetName: string;
  invitedByName: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
};

export type LedgerMember = {
  userId: string;
  displayName: string;
  role: LedgerMemberRole;
  joinedAt: string;
};

export type SharedLedgerPageData = {
  currentLedger: SharedLedgerSummary;
  ledgers: SharedLedgerSummary[];
  receivedInvitations: LedgerInvitation[];
  sentInvitations: LedgerInvitation[];
  members: LedgerMember[];
};

export type SharedLedgerActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialSharedLedgerActionState: SharedLedgerActionState = { status: "idle" };

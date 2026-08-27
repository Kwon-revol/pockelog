import type { LedgerKind, LedgerMemberRole } from "@/features/shared-ledgers/types";

export type AppLedger = {
  id: string;
  name: string;
  kind: LedgerKind;
  role: LedgerMemberRole;
};

export type AppLedgerContext = {
  userId: string;
  userName: string;
  currentLedger: AppLedger;
  ledgers: AppLedger[];
  pendingInvitationCount: number;
  needsDefaultRepair: boolean;
};

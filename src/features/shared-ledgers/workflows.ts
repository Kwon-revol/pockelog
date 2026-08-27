import { idSchema } from "@/features/shared-ledgers/schemas";
import type { SharedLedgerActionState } from "@/features/shared-ledgers/types";

type ChangeResult = "updated" | "forbidden" | "error";
type CreateLedgerResult = "created" | "duplicate" | "forbidden" | "error";
type InvitationCreateResult = "created" | "duplicate" | "member" | "personal" | "self" | "forbidden" | "error";
type InvitationResponseResult = "accepted" | "declined" | "expired" | "processed" | "forbidden" | "error";
type RevokeResult = "revoked" | "processed" | "forbidden" | "error";
type RemoveResult = "removed" | "owner" | "missing" | "forbidden" | "error";
type LeaveResult = "left" | "personal" | "owner" | "missing" | "error";
type DeleteResult = "deleted" | "personal" | "confirmation" | "forbidden" | "error";
type TargetResult = { status: "found"; userId: string } | { status: "not_found" | "self" | "error" };

export interface SharedLedgerGateway {
  getUserId(): Promise<string | null>;
  createSharedLedger(name: string): Promise<CreateLedgerResult>;
  switchLedger(ledgerId: string): Promise<ChangeResult>;
  resolveInvitationTarget(identifier: string, currentUserId: string): Promise<TargetResult>;
  createInvitation(ledgerId: string, targetUserId: string): Promise<InvitationCreateResult>;
  respondToInvitation(invitationId: string, response: "accept" | "decline"): Promise<InvitationResponseResult>;
  revokeInvitation(invitationId: string): Promise<RevokeResult>;
  removeMember(ledgerId: string, userId: string): Promise<RemoveResult>;
  leaveSharedLedger(ledgerId: string): Promise<LeaveResult>;
  deleteSharedLedger(ledgerId: string, confirmationName: string): Promise<DeleteResult>;
}

const FAILED = "공동 장부를 변경하지 못했습니다. 다시 시도해 주세요.";

async function signedInUser(gateway: SharedLedgerGateway): Promise<string | SharedLedgerActionState> {
  try {
    return await gateway.getUserId() ?? { status: "error", message: "로그인이 필요합니다." };
  } catch {
    return { status: "error", message: FAILED };
  }
}

function isState(value: string | SharedLedgerActionState): value is SharedLedgerActionState {
  return typeof value !== "string";
}

async function withUser(
  gateway: SharedLedgerGateway,
  action: (userId: string) => Promise<SharedLedgerActionState>,
): Promise<SharedLedgerActionState> {
  const user = await signedInUser(gateway);
  if (isState(user)) return user;
  try {
    return await action(user);
  } catch {
    return { status: "error", message: FAILED };
  }
}

export function createSharedLedger(
  input: { name: string },
  gateway: SharedLedgerGateway,
): Promise<SharedLedgerActionState> {
  return withUser(gateway, async () => {
    const result = await gateway.createSharedLedger(input.name);
    if (result === "created") return { status: "success", message: "공동 장부를 만들었어요." };
    if (result === "duplicate") return { status: "error", message: "같은 이름의 장부가 이미 있어요." };
    return { status: "error", message: result === "forbidden" ? "공동 장부를 만들 권한이 없어요." : FAILED };
  });
}

export function switchLedger(ledgerId: string, gateway: SharedLedgerGateway): Promise<SharedLedgerActionState> {
  if (!idSchema.safeParse(ledgerId).success) return Promise.resolve({ status: "error", message: FAILED });
  return withUser(gateway, async () => {
    const result = await gateway.switchLedger(ledgerId);
    return result === "updated"
      ? { status: "success", message: "장부를 전환했어요." }
      : { status: "error", message: result === "forbidden" ? "참여 중인 장부만 선택할 수 있어요." : FAILED };
  });
}

export function inviteLedgerMember(
  input: { ledgerId: string; identifier: string },
  gateway: SharedLedgerGateway,
): Promise<SharedLedgerActionState> {
  if (!idSchema.safeParse(input.ledgerId).success) return Promise.resolve({ status: "error", message: FAILED });
  return withUser(gateway, async (currentUserId) => {
    const target = await gateway.resolveInvitationTarget(input.identifier, currentUserId);
    if (target.status !== "found") {
      const messages = {
        not_found: "초대할 사용자를 찾지 못했어요.",
        self: "본인은 초대할 수 없어요.",
        error: FAILED,
      } as const;
      return { status: "error", message: messages[target.status] };
    }
    const result = await gateway.createInvitation(input.ledgerId, target.userId);
    const messages: Record<Exclude<InvitationCreateResult, "created" | "error">, string> = {
      duplicate: "이미 대기 중인 초대가 있어요.",
      member: "이미 장부에 참여 중인 사용자예요.",
      personal: "개인 장부에는 사용자를 초대할 수 없어요.",
      self: "본인은 초대할 수 없어요.",
      forbidden: "장부 소유자만 초대할 수 있어요.",
    };
    return result === "created"
      ? { status: "success", message: "공동 장부 초대를 보냈어요." }
      : { status: "error", message: result === "error" ? FAILED : messages[result] };
  });
}

export function respondToInvitation(
  invitationId: string,
  response: "accept" | "decline",
  gateway: SharedLedgerGateway,
): Promise<SharedLedgerActionState> {
  if (!idSchema.safeParse(invitationId).success) return Promise.resolve({ status: "error", message: FAILED });
  return withUser(gateway, async () => {
    const result = await gateway.respondToInvitation(invitationId, response);
    if (result === "accepted") return { status: "success", message: "공동 장부 초대를 수락했어요." };
    if (result === "declined") return { status: "success", message: "공동 장부 초대를 거절했어요." };
    if (result === "expired") return { status: "error", message: "초대가 만료됐어요." };
    if (result === "processed") return { status: "error", message: "이미 처리된 초대예요." };
    return { status: "error", message: result === "forbidden" ? "본인에게 온 초대만 처리할 수 있어요." : FAILED };
  });
}

export function revokeInvitation(invitationId: string, gateway: SharedLedgerGateway): Promise<SharedLedgerActionState> {
  if (!idSchema.safeParse(invitationId).success) return Promise.resolve({ status: "error", message: FAILED });
  return withUser(gateway, async () => {
    const result = await gateway.revokeInvitation(invitationId);
    if (result === "revoked") return { status: "success", message: "초대를 취소했어요." };
    if (result === "processed") return { status: "error", message: "이미 처리된 초대예요." };
    return { status: "error", message: result === "forbidden" ? "장부 소유자만 초대를 취소할 수 있어요." : FAILED };
  });
}

export function removeLedgerMember(
  ledgerId: string,
  userId: string,
  gateway: SharedLedgerGateway,
): Promise<SharedLedgerActionState> {
  if (![ledgerId, userId].every((value) => idSchema.safeParse(value).success)) return Promise.resolve({ status: "error", message: FAILED });
  return withUser(gateway, async () => {
    const result = await gateway.removeMember(ledgerId, userId);
    if (result === "removed") return { status: "success", message: "구성원을 제거했어요." };
    return { status: "error", message: result === "forbidden" ? "장부 소유자만 구성원을 제거할 수 있어요." : FAILED };
  });
}

export function leaveSharedLedger(ledgerId: string, gateway: SharedLedgerGateway): Promise<SharedLedgerActionState> {
  if (!idSchema.safeParse(ledgerId).success) return Promise.resolve({ status: "error", message: FAILED });
  return withUser(gateway, async () => {
    const result = await gateway.leaveSharedLedger(ledgerId);
    if (result === "left") return { status: "success", message: "공동 장부에서 나왔어요." };
    if (result === "personal") return { status: "error", message: "개인 장부에서는 나갈 수 없어요." };
    if (result === "owner") return { status: "error", message: "장부 소유자는 공동 장부에서 나갈 수 없어요." };
    return { status: "error", message: FAILED };
  });
}

export function deleteSharedLedger(
  input: { ledgerId: string; confirmationName: string },
  gateway: SharedLedgerGateway,
): Promise<SharedLedgerActionState> {
  if (!idSchema.safeParse(input.ledgerId).success) return Promise.resolve({ status: "error", message: FAILED });
  return withUser(gateway, async () => {
    const result = await gateway.deleteSharedLedger(input.ledgerId, input.confirmationName);
    if (result === "deleted") return { status: "success", message: "공동 장부를 삭제했어요." };
    if (result === "confirmation") return { status: "error", message: "장부 이름이 일치하지 않아요." };
    if (result === "personal") return { status: "error", message: "개인 장부는 삭제할 수 없어요." };
    return { status: "error", message: result === "forbidden" ? "장부 소유자만 삭제할 수 있어요." : FAILED };
  });
}

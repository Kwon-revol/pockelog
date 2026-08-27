import { describe, expect, it } from "vitest";

import {
  createSharedLedger,
  deleteSharedLedger,
  inviteLedgerMember,
  leaveSharedLedger,
  removeLedgerMember,
  respondToInvitation,
  revokeInvitation,
  switchLedger,
  type SharedLedgerGateway,
} from "@/features/shared-ledgers/workflows";

const userId = "11111111-1111-4111-8111-111111111111";
const ledgerId = "22222222-2222-4222-8222-222222222222";
const targetId = "33333333-3333-4333-8333-333333333333";
const invitationId = "44444444-4444-4444-8444-444444444444";

function gateway(overrides: Partial<SharedLedgerGateway> = {}): SharedLedgerGateway {
  return {
    async getUserId() { return userId; },
    async createSharedLedger() { return "created"; },
    async switchLedger() { return "updated"; },
    async resolveInvitationTarget() { return { status: "found", userId: targetId }; },
    async createInvitation() { return "created"; },
    async respondToInvitation() { return "accepted"; },
    async revokeInvitation() { return "revoked"; },
    async removeMember() { return "removed"; },
    async leaveSharedLedger() { return "left"; },
    async deleteSharedLedger() { return "deleted"; },
    ...overrides,
  };
}

describe("shared ledger workflows", () => {
  it("creates and switches ledgers for a signed-in user", async () => {
    await expect(createSharedLedger({ name: "우리 집" }, gateway())).resolves.toEqual({
      status: "success",
      message: "공동 장부를 만들었어요.",
    });
    await expect(switchLedger(ledgerId, gateway())).resolves.toEqual({
      status: "success",
      message: "장부를 전환했어요.",
    });
  });

  it("does not mutate data without a signed-in user", async () => {
    let changed = false;
    const signedOut = gateway({
      async getUserId() { return null; },
      async createSharedLedger() { changed = true; return "created"; },
    });

    await expect(createSharedLedger({ name: "우리 집" }, signedOut)).resolves.toEqual({
      status: "error",
      message: "로그인이 필요합니다.",
    });
    expect(changed).toBe(false);
  });

  it.each([
    ["not_found", "초대할 사용자를 찾지 못했어요."],
    ["self", "본인은 초대할 수 없어요."],
  ] as const)("maps target resolution result %s", async (status, message) => {
    const result = await inviteLedgerMember(
      { ledgerId, identifier: "target_user" },
      gateway({ async resolveInvitationTarget() { return { status }; } }),
    );
    expect(result).toEqual({ status: "error", message });
  });

  it.each([
    ["duplicate", "이미 대기 중인 초대가 있어요."],
    ["member", "이미 장부에 참여 중인 사용자예요."],
    ["personal", "개인 장부에는 사용자를 초대할 수 없어요."],
    ["forbidden", "장부 소유자만 초대할 수 있어요."],
  ] as const)("maps invitation result %s", async (status, message) => {
    const result = await inviteLedgerMember(
      { ledgerId, identifier: "target_user" },
      gateway({ async createInvitation() { return status; } }),
    );
    expect(result).toEqual({ status: "error", message });
  });

  it("accepts and declines invitations with distinct messages", async () => {
    await expect(respondToInvitation(invitationId, "accept", gateway())).resolves.toEqual({
      status: "success",
      message: "공동 장부 초대를 수락했어요.",
    });
    await expect(respondToInvitation(invitationId, "decline", gateway({
      async respondToInvitation() { return "declined"; },
    }))).resolves.toEqual({
      status: "success",
      message: "공동 장부 초대를 거절했어요.",
    });
  });

  it("reports an expired invitation without claiming success", async () => {
    await expect(respondToInvitation(invitationId, "accept", gateway({
      async respondToInvitation() { return "expired"; },
    }))).resolves.toEqual({
      status: "error",
      message: "초대가 만료됐어요.",
    });
  });

  it("revokes invitations and removes or leaves members", async () => {
    await expect(revokeInvitation(invitationId, gateway())).resolves.toMatchObject({ status: "success" });
    await expect(removeLedgerMember(ledgerId, targetId, gateway())).resolves.toMatchObject({ status: "success" });
    await expect(leaveSharedLedger(ledgerId, gateway())).resolves.toEqual({
      status: "success",
      message: "공동 장부에서 나왔어요.",
    });
  });

  it("rejects leaving a personal ledger and owner-only member changes", async () => {
    await expect(leaveSharedLedger(ledgerId, gateway({
      async leaveSharedLedger() { return "personal"; },
    }))).resolves.toEqual({
      status: "error",
      message: "개인 장부에서는 나갈 수 없어요.",
    });
    await expect(removeLedgerMember(ledgerId, targetId, gateway({
      async removeMember() { return "forbidden"; },
    }))).resolves.toEqual({
      status: "error",
      message: "장부 소유자만 구성원을 제거할 수 있어요.",
    });
  });

  it("deletes a shared ledger only after confirmation reaches the gateway", async () => {
    let confirmation = "";
    const result = await deleteSharedLedger(
      { ledgerId, confirmationName: "우리 집" },
      gateway({
        async deleteSharedLedger(_id, name) { confirmation = name; return "deleted"; },
      }),
    );

    expect(result).toEqual({ status: "success", message: "공동 장부를 삭제했어요." });
    expect(confirmation).toBe("우리 집");
  });
});

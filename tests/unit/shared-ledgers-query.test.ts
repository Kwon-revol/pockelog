import { describe, expect, it } from "vitest";

import {
  mapInvitations,
  mapLedgerContext,
  mapMembers,
} from "@/features/shared-ledgers/query-utils";
import { mapInvitationCreateError } from "@/features/shared-ledgers/gateway-utils";

const userId = "11111111-1111-4111-8111-111111111111";
const personalId = "22222222-2222-4222-8222-222222222222";
const sharedId = "33333333-3333-4333-8333-333333333333";

describe("shared ledger query mapping", () => {
  it("selects an accessible default ledger and sorts personal before shared ledgers", () => {
    const result = mapLedgerContext(
      userId,
      "권혁",
      sharedId,
      [
        { role: "member", joined_at: "2026-08-02T00:00:00Z", ledger: { id: sharedId, name: "우리 집", kind: "shared" } },
        { role: "owner", joined_at: "2026-08-01T00:00:00Z", ledger: { id: personalId, name: "내 장부", kind: "personal" } },
      ],
      2,
    );

    expect(result?.currentLedger.id).toBe(sharedId);
    expect(result?.ledgers.map((ledger) => ledger.id)).toEqual([personalId, sharedId]);
    expect(result?.pendingInvitationCount).toBe(2);
  });

  it("falls back to the personal ledger when the stored ledger is no longer accessible", () => {
    const result = mapLedgerContext(
      userId,
      "권혁",
      "44444444-4444-4444-8444-444444444444",
      [{ role: "owner", joined_at: "2026-08-01T00:00:00Z", ledger: { id: personalId, name: "내 장부", kind: "personal" } }],
      0,
    );

    expect(result?.currentLedger.id).toBe(personalId);
    expect(result?.needsDefaultRepair).toBe(true);
  });

  it("maps expired pending invitations without changing accepted invitations", () => {
    const now = new Date("2026-08-27T12:00:00Z");
    const rows = [
      {
        id: "55555555-5555-4555-8555-555555555555",
        ledger_id: sharedId,
        target_user_id: userId,
        invited_by: "66666666-6666-4666-8666-666666666666",
        status: "pending",
        expires_at: "2026-08-26T12:00:00Z",
        created_at: "2026-08-20T12:00:00Z",
        ledger_name: "우리 집",
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        ledger_id: sharedId,
        target_user_id: userId,
        invited_by: "66666666-6666-4666-8666-666666666666",
        status: "accepted",
        expires_at: "2026-08-30T12:00:00Z",
        created_at: "2026-08-23T12:00:00Z",
        ledger_name: "우리 집",
      },
    ] as const;

    const result = mapInvitations(rows, new Map([
      [userId, "권혁"],
      ["66666666-6666-4666-8666-666666666666", "초대한 사람"],
    ]), now);

    expect(result.map((invitation) => invitation.status)).toEqual(["expired", "accepted"]);
    expect(result[0]).toMatchObject({ invitedByName: "초대한 사람", targetName: "권혁" });
  });

  it("maps owner first and supplies a safe fallback for a missing profile", () => {
    const result = mapMembers(
      [
        { user_id: userId, role: "owner", joined_at: "2026-08-01T00:00:00Z" },
        { user_id: "88888888-8888-4888-8888-888888888888", role: "member", joined_at: "2026-08-02T00:00:00Z" },
      ],
      new Map([[userId, "권혁"]]),
    );

    expect(result[0]).toMatchObject({ displayName: "권혁", role: "owner" });
    expect(result[1].displayName).toBe("알 수 없는 사용자");
  });

  it("maps invitation database failures without exposing raw messages", () => {
    expect(mapInvitationCreateError({ code: "23505", message: "duplicate key" })).toBe("duplicate");
    expect(mapInvitationCreateError({ code: "42501", message: "ledger owner required" })).toBe("forbidden");
    expect(mapInvitationCreateError({ code: "P0001", message: "target already member" })).toBe("member");
    expect(mapInvitationCreateError({ code: "P0001", message: "shared ledger required" })).toBe("personal");
    expect(mapInvitationCreateError({ code: "XX000", message: "secret database detail" })).toBe("error");
  });
});

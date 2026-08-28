import { describe, expect, it } from "vitest";

import {
  deleteSharedLedgerSchema,
  invitationIdentifierSchema,
  sharedLedgerNameSchema,
} from "@/features/shared-ledgers/schemas";

const ledgerId = "11111111-1111-4111-8111-111111111111";

describe("shared ledger input schemas", () => {
  it("normalizes shared ledger names and rejects empty names", () => {
    expect(sharedLedgerNameSchema.safeParse("  우리 집  ")).toMatchObject({
      success: true,
      data: "우리 집",
    });
    expect(sharedLedgerNameSchema.safeParse("   ").success).toBe(false);
    expect(sharedLedgerNameSchema.safeParse("가".repeat(51)).success).toBe(false);
  });

  it("normalizes login ids and emails used for invitations", () => {
    expect(invitationIdentifierSchema.safeParse("  User_Name  ")).toMatchObject({
      success: true,
      data: "user_name",
    });
    expect(invitationIdentifierSchema.safeParse("  Person@Example.COM ")).toMatchObject({
      success: true,
      data: "person@example.com",
    });
    expect(invitationIdentifierSchema.safeParse("not valid").success).toBe(false);
  });

  it("requires a valid ledger id and non-empty confirmation name for deletion", () => {
    expect(deleteSharedLedgerSchema.safeParse({ ledgerId, confirmationName: "  우리 집  " })).toMatchObject({
      success: true,
      data: { ledgerId, confirmationName: "우리 집" },
    });
    expect(deleteSharedLedgerSchema.safeParse({ ledgerId: "wrong", confirmationName: "우리 집" }).success).toBe(false);
    expect(deleteSharedLedgerSchema.safeParse({ ledgerId, confirmationName: " " }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { decodeTrashCursor, encodeTrashCursor } from "@/features/trash/cursor";
import { trashPageParamsSchema, trashTransactionIdSchema } from "@/features/trash/schemas";

describe("trash domain", () => {
  it("round-trips a deleted-at and UUID cursor", () => {
    const cursor = { deletedAt: "2026-09-01T01:02:03.000Z", id: "11111111-1111-4111-8111-111111111111" };
    expect(decodeTrashCursor(encodeTrashCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursors and transaction ids", () => {
    expect(decodeTrashCursor("not-base64")).toBeNull();
    expect(trashTransactionIdSchema.safeParse("not-an-id").success).toBe(false);
    expect(trashPageParamsSchema.safeParse({ cursor: "not-base64" }).success).toBe(false);
  });
});

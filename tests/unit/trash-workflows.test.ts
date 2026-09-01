import { describe, expect, it } from "vitest";

import type { TrashMutationResult } from "@/features/trash/types";
import {
  permanentlyDeleteTransaction,
  restoreDeletedTransaction,
  type TrashMutationGateway,
} from "@/features/trash/workflows";

const transactionId = "11111111-1111-4111-8111-111111111111";

function gateway(result: TrashMutationResult): TrashMutationGateway {
  return {
    async restore() { return result; },
    async permanentlyDelete() { return result; },
  };
}

describe("trash mutation workflows", () => {
  it("maps restored and missing without exposing another ledger", async () => {
    await expect(restoreDeletedTransaction(transactionId, gateway("restored"))).resolves.toEqual({
      status: "success",
      message: "내역을 복원했어요.",
    });
    await expect(restoreDeletedTransaction(transactionId, gateway("missing"))).resolves.toEqual({
      status: "error",
      message: "이 내역을 변경할 수 없습니다.",
    });
    await expect(restoreDeletedTransaction(transactionId, gateway("forbidden"))).resolves.toEqual({
      status: "error",
      message: "이 내역을 변경할 수 없습니다.",
    });
  });

  it("uses a retry message only for a restore system failure", async () => {
    await expect(restoreDeletedTransaction(transactionId, gateway("error"))).resolves.toEqual({
      status: "error",
      message: "복원하지 못했습니다. 다시 시도해 주세요.",
    });
  });

  it("maps permanent deletion success, hidden targets, and system failures", async () => {
    await expect(
      permanentlyDeleteTransaction(transactionId, gateway("deleted")),
    ).resolves.toEqual({ status: "success", message: "내역을 영구 삭제했어요." });
    await expect(
      permanentlyDeleteTransaction(transactionId, gateway("missing")),
    ).resolves.toEqual({ status: "error", message: "이 내역을 변경할 수 없습니다." });
    await expect(
      permanentlyDeleteTransaction(transactionId, gateway("error")),
    ).resolves.toEqual({
      status: "error",
      message: "영구 삭제하지 못했습니다. 다시 시도해 주세요.",
    });
  });
});

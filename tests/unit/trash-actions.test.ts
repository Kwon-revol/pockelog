import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseTrashGateway: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/trash/supabase-gateway", () => ({
  createSupabaseTrashGateway: mocks.createSupabaseTrashGateway,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  permanentlyDeleteTransactionAction,
  restoreDeletedTransactionAction,
} from "@/features/trash/actions";

const transactionId = "11111111-1111-4111-8111-111111111111";
const affectedPaths = ["/settings/trash", "/ledger", "/statistics", "/tax-goals"];

describe("trash server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    [restoreDeletedTransactionAction],
    [permanentlyDeleteTransactionAction],
  ])("rejects a malformed UUID before creating a gateway", async (action) => {
    await expect(action("not-a-uuid")).resolves.toEqual({
      status: "error",
      message: "이 내역을 변경할 수 없습니다.",
    });
    expect(mocks.createSupabaseTrashGateway).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    [restoreDeletedTransactionAction, "restored", "내역을 복원했어요."],
    [permanentlyDeleteTransactionAction, "deleted", "내역을 영구 삭제했어요."],
  ] as const)("revalidates every consumer after a successful mutation", async (action, result, message) => {
    mocks.createSupabaseTrashGateway.mockResolvedValue({
      restore: vi.fn().mockResolvedValue(result),
      permanentlyDelete: vi.fn().mockResolvedValue(result),
    });

    await expect(action(transactionId)).resolves.toEqual({ status: "success", message });
    for (const path of affectedPaths) {
      expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
    }
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
  });

  it("does not revalidate consumers after a failed mutation", async () => {
    mocks.createSupabaseTrashGateway.mockResolvedValue({
      restore: vi.fn().mockResolvedValue("missing"),
      permanentlyDelete: vi.fn().mockResolvedValue("missing"),
    });

    await expect(restoreDeletedTransactionAction(transactionId)).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

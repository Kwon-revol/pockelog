import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseTransactionGateway: vi.fn(),
  createTransaction: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/features/transactions/supabase-gateway", () => ({
  createSupabaseTransactionGateway: mocks.createSupabaseTransactionGateway,
}));
vi.mock("@/features/transactions/workflows", () => ({
  createTransaction: mocks.createTransaction,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createTransactionAction } from "@/features/transactions/actions";

function validFormData(marker?: string) {
  const data = new FormData();
  data.set("type", "expense");
  data.set("occurredOn", "2026-08-28");
  data.set("description", "8월 연금저축");
  data.set("amount", "500000");
  data.set("categoryId", "11111111-1111-4111-8111-111111111111");
  data.set("memo", "");
  data.set("idempotencyKey", "22222222-2222-4222-8222-222222222222");
  if (marker) data.set("pensionContributionPreset", marker);
  return data;
}

describe("createTransactionAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createSupabaseTransactionGateway.mockResolvedValue({});
  });

  it("revalidates before redirecting a successful pension preset create", async () => {
    const calls: string[] = [];
    mocks.createTransaction.mockResolvedValue({ status: "success", message: "내역을 저장했어요." });
    mocks.revalidatePath.mockImplementation(() => { calls.push("revalidate"); });
    mocks.redirect.mockImplementation(() => {
      calls.push("redirect");
      throw new Error("NEXT_REDIRECT:/ledger");
    });

    await expect(
      createTransactionAction({ status: "idle" }, validFormData("1")),
    ).rejects.toThrow("NEXT_REDIRECT:/ledger");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ledger");
    expect(mocks.redirect).toHaveBeenCalledWith("/ledger");
    expect(calls).toEqual(["revalidate", "redirect"]);
  });

  it("returns a successful state for a normal create without redirecting", async () => {
    const result = { status: "success" as const, message: "내역을 저장했어요." };
    mocks.createTransaction.mockResolvedValue(result);

    await expect(
      createTransactionAction({ status: "idle" }, validFormData()),
    ).resolves.toEqual(result);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ledger");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does not redirect a failed preset create", async () => {
    const result = { status: "error" as const, message: "내역을 저장하지 못했습니다. 다시 시도해 주세요." };
    mocks.createTransaction.mockResolvedValue(result);

    await expect(
      createTransactionAction({ status: "idle" }, validFormData("1")),
    ).resolves.toEqual(result);

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

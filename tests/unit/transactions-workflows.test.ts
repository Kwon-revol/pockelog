import { describe, expect, it } from "vitest";

import {
  createTransaction,
  trashTransaction,
  updateTransaction,
  type TransactionGateway,
} from "@/features/transactions/workflows";

const validInput = {
  type: "expense" as const,
  occurredOn: "2026-08-26",
  description: "점심",
  amount: 12500,
  categoryId: "11111111-1111-4111-8111-111111111111",
  memo: "동료와 식사",
  idempotencyKey: "22222222-2222-4222-8222-222222222222",
};

function createGateway(overrides: Partial<TransactionGateway> = {}): TransactionGateway {
  return {
    async getSessionContext() {
      return {
        userId: "33333333-3333-4333-8333-333333333333",
        ledgerId: "44444444-4444-4444-8444-444444444444",
      };
    },
    async create() {
      return "created";
    },
    async update() {
      return "updated";
    },
    async trash() {
      return "trashed";
    },
    ...overrides,
  };
}

describe("transaction workflows", () => {
  it("creates a validated transaction in the signed-in default ledger", async () => {
    const created: Array<{ ledgerId: string; userId: string; description: string }> = [];
    const gateway = createGateway({
      async create(context, input) {
        created.push({ ...context, description: input.description });
        return "created";
      },
    });

    await expect(createTransaction(validInput, gateway)).resolves.toEqual({
      status: "success",
      message: "내역을 저장했어요.",
    });
    expect(created).toEqual([{
      ledgerId: "44444444-4444-4444-8444-444444444444",
      userId: "33333333-3333-4333-8333-333333333333",
      description: "점심",
    }]);
  });

  it("treats an idempotency collision as the same successful save", async () => {
    const gateway = createGateway({ async create() { return "duplicate"; } });
    await expect(createTransaction(validInput, gateway)).resolves.toMatchObject({ status: "success" });
  });

  it("returns a session error without calling a mutation", async () => {
    let mutated = false;
    const gateway = createGateway({
      async getSessionContext() { return null; },
      async create() { mutated = true; return "created"; },
    });

    await expect(createTransaction(validInput, gateway)).resolves.toEqual({
      status: "error",
      message: "로그인이 필요합니다.",
    });
    expect(mutated).toBe(false);
  });

  it("does not misreport a default-ledger lookup failure as logout", async () => {
    const gateway = createGateway({
      async getSessionContext() { throw new Error("database unavailable"); },
    });

    await expect(createTransaction(validInput, gateway)).resolves.toEqual({
      status: "error",
      message: "내역을 저장하지 못했습니다. 다시 시도해 주세요.",
    });
  });

  it("maps inaccessible updates and trash operations to one safe message", async () => {
    const gateway = createGateway({
      async update() { return "forbidden"; },
      async trash() { return "forbidden"; },
    });

    await expect(
      updateTransaction("55555555-5555-4555-8555-555555555555", validInput, gateway),
    ).resolves.toEqual({ status: "error", message: "이 내역을 변경할 수 없습니다." });
    await expect(
      trashTransaction("55555555-5555-4555-8555-555555555555", gateway),
    ).resolves.toEqual({ status: "error", message: "이 내역을 변경할 수 없습니다." });
  });

  it("rejects a malformed transaction ID before reaching the gateway", async () => {
    let mutated = false;
    const gateway = createGateway({ async update() { mutated = true; return "updated"; } });
    await expect(updateTransaction("wrong", validInput, gateway)).resolves.toMatchObject({ status: "error" });
    expect(mutated).toBe(false);
  });
});

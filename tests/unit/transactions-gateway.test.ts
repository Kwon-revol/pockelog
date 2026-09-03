import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("@/shared/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { createSupabaseTransactionGateway } from "@/features/transactions/supabase-gateway";

const context = {
  userId: "22222222-2222-4222-8222-222222222222",
  ledgerId: "33333333-3333-4333-8333-333333333333",
};
const transactionId = "11111111-1111-4111-8111-111111111111";

function chain(result: { data: unknown; error: unknown }) {
  const response = Promise.resolve(result);
  const query = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(async () => result),
    then: response.then.bind(response),
  };
  for (const method of ["select", "update", "eq", "is"] as const) {
    query[method].mockReturnValue(query);
  }
  return query;
}

describe("createSupabaseTransactionGateway.trash", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
    mocks.createAdminClient.mockReset();
  });

  it("uses the trash RPC when it is available", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "trashed", error: null });
    mocks.createServerClient.mockResolvedValue({ rpc, from: vi.fn() });

    const gateway = await createSupabaseTransactionGateway();

    await expect(gateway.trash(context, transactionId)).resolves.toBe("trashed");
    expect(rpc).toHaveBeenCalledWith("trash_active_transaction", {
      target_transaction_id: transactionId,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("falls back to a privileged update when the trash RPC is not deployed yet", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42883", message: "function trash_active_transaction(uuid) does not exist" },
    });
    const existing = chain({
      data: { id: transactionId, created_by: context.userId },
      error: null,
    });
    const ledger = chain({ data: { owner_id: context.userId }, error: null });
    const from = vi.fn()
      .mockReturnValueOnce(existing)
      .mockReturnValueOnce(ledger);
    const adminUpdate = chain({ data: null, error: null });
    mocks.createServerClient.mockResolvedValue({ rpc, from });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => adminUpdate) });

    const gateway = await createSupabaseTransactionGateway();

    await expect(gateway.trash(context, transactionId)).resolves.toBe("trashed");
    expect(adminUpdate.update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
      deleted_by: context.userId,
    });
  });
});

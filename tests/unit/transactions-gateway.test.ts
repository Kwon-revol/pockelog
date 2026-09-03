import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

import { createSupabaseTransactionGateway } from "@/features/transactions/supabase-gateway";

const context = {
  userId: "22222222-2222-4222-8222-222222222222",
  ledgerId: "33333333-3333-4333-8333-333333333333",
};
const transactionId = "11111111-1111-4111-8111-111111111111";

function chain(result: { data: unknown; error: unknown; count?: number | null }) {
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
  });

  it("treats a successful soft delete as trashed even when PostgREST count is missing", async () => {
    const existing = chain({ data: { id: transactionId }, error: null });
    const update = chain({ data: null, error: null, count: null });
    const from = vi.fn()
      .mockReturnValueOnce(existing)
      .mockReturnValueOnce(update);
    mocks.createServerClient.mockResolvedValue({ from });

    const gateway = await createSupabaseTransactionGateway();

    await expect(gateway.trash(context, transactionId)).resolves.toBe("trashed");
    expect(from).toHaveBeenCalledWith("transactions");
    expect(update.update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
      deleted_by: context.userId,
    });
  });

  it("does not mark a missing transaction as trashed", async () => {
    const existing = chain({ data: null, error: null });
    const from = vi.fn().mockReturnValueOnce(existing);
    mocks.createServerClient.mockResolvedValue({ from });

    const gateway = await createSupabaseTransactionGateway();

    await expect(gateway.trash(context, transactionId)).resolves.toBe("forbidden");
    expect(from).toHaveBeenCalledOnce();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

import { createSupabaseTrashGateway } from "@/features/trash/supabase-gateway";

const transactionId = "11111111-1111-4111-8111-111111111111";
const user = { id: "22222222-2222-4222-8222-222222222222" };

describe("createSupabaseTrashGateway", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
  });

  it.each([
    ["restore", "restore_deleted_transaction", "restored"],
    ["permanentlyDelete", "permanently_delete_transaction", "deleted"],
  ] as const)("calls the exact %s RPC contract", async (method, rpcName, result) => {
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    const getUser = vi.fn().mockResolvedValue({ data: { user } });
    mocks.createServerClient.mockResolvedValue({ auth: { getUser }, rpc });

    const gateway = await createSupabaseTrashGateway();

    await expect(gateway[method](transactionId)).resolves.toBe(result);
    expect(getUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(rpcName, { target_transaction_id: transactionId });
  });

  it.each([
    ["restore"],
    ["permanentlyDelete"],
  ] as const)("returns an unauthenticated result before the %s RPC after session expiry", async (method) => {
    const rpc = vi.fn();
    const getUser = vi.fn().mockResolvedValue({ data: { user: null } });
    mocks.createServerClient.mockResolvedValue({ auth: { getUser }, rpc });

    const gateway = await createSupabaseTrashGateway();

    await expect(gateway[method](transactionId)).resolves.toBe("unauthenticated");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["restore", "restore_deleted_transaction"],
    ["permanentlyDelete", "permanently_delete_transaction"],
  ] as const)("maps authentication, authorization, and other %s RPC errors safely", async (method, rpcName) => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "28000", message: "secret" } })
      .mockResolvedValueOnce({ data: null, error: { code: "42501", message: "secret" } })
      .mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "secret" } });
    mocks.createServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      rpc,
    });
    const gateway = await createSupabaseTrashGateway();

    await expect(gateway[method](transactionId)).resolves.toBe("unauthenticated");
    await expect(gateway[method](transactionId)).resolves.toBe("forbidden");
    await expect(gateway[method](transactionId)).resolves.toBe("error");
    expect(rpc).toHaveBeenNthCalledWith(1, rpcName, { target_transaction_id: transactionId });
    expect(rpc).toHaveBeenNthCalledWith(2, rpcName, { target_transaction_id: transactionId });
    expect(rpc).toHaveBeenNthCalledWith(3, rpcName, { target_transaction_id: transactionId });
  });
});

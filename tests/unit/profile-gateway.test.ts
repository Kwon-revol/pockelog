import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

import { createSupabaseProfileGateway } from "@/features/profile/supabase-gateway";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.com",
};
const profileInput = { displayName: "새 이름", phone: "01012345678" };
const passwordInput = { currentPassword: "old-secret", newPassword: "new-secret" };

function serverClient({
  current = { data: { user }, error: null },
  verified = { data: { user }, error: null },
  changed = { data: { user }, error: null },
  rpcResult = { data: "updated", error: null },
  globalLogout = { error: null },
  localLogout = { error: null },
}: {
  current?: { data: { user: typeof user | null }; error: { message: string } | null };
  verified?: { data: { user: { id: string } | null }; error: { message: string } | null };
  changed?: { data: { user: typeof user | null }; error: { message: string } | null };
  rpcResult?: { data: string | null; error: { message: string } | null };
  globalLogout?: { error: { message: string } | null };
  localLogout?: { error: { message: string } | null };
} = {}) {
  const getUser = vi.fn().mockResolvedValue(current);
  const signInWithPassword = vi.fn().mockResolvedValue(verified);
  const updateUser = vi.fn().mockResolvedValue(changed);
  const signOut = vi.fn(async ({ scope }: { scope: "global" | "local" }) => (
    scope === "global" ? globalLogout : localLogout
  ));
  const rpc = vi.fn().mockResolvedValue(rpcResult);

  return {
    client: { auth: { getUser, signInWithPassword, updateUser, signOut }, rpc },
    spies: { getUser, signInWithPassword, updateUser, signOut, rpc },
  };
}

describe("createSupabaseProfileGateway", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
  });

  it("passes only normalized profile fields to update_my_profile", async () => {
    const fake = serverClient();
    mocks.createServerClient.mockResolvedValue(fake.client);
    const gateway = await createSupabaseProfileGateway();

    await expect(gateway.updateProfile(profileInput)).resolves.toBe("updated");
    expect(fake.spies.getUser).toHaveBeenCalledOnce();
    expect(fake.spies.rpc).toHaveBeenCalledWith("update_my_profile", {
      new_display_name: "새 이름",
      new_phone_normalized: "01012345678",
    });
  });

  it.each([
    [{ data: "unexpected", error: null }],
    [{ data: null, error: { message: "secret database detail" } }],
  ])("maps non-updated RPC outcomes to a safe error result", async (rpcResult) => {
    const fake = serverClient({ rpcResult });
    mocks.createServerClient.mockResolvedValue(fake.client);
    const gateway = await createSupabaseProfileGateway();

    await expect(gateway.updateProfile(profileInput)).resolves.toBe("error");
  });

  it("returns unauthenticated before the profile RPC when the session is absent", async () => {
    const fake = serverClient({ current: { data: { user: null }, error: null } });
    mocks.createServerClient.mockResolvedValue(fake.client);
    const gateway = await createSupabaseProfileGateway();

    await expect(gateway.updateProfile(profileInput)).resolves.toBe("unauthenticated");
    expect(fake.spies.rpc).not.toHaveBeenCalled();
  });

  it("does not update the password when current-password verification fails", async () => {
    const fake = serverClient({
      verified: { data: { user: null }, error: { message: "invalid credentials" } },
    });
    mocks.createServerClient.mockResolvedValue(fake.client);
    const gateway = await createSupabaseProfileGateway();

    await expect(gateway.changePassword(passwordInput)).resolves.toBe("invalid-current-password");
    expect(fake.spies.signInWithPassword).toHaveBeenCalledWith({
      email: user.email,
      password: passwordInput.currentPassword,
    });
    expect(fake.spies.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a verified identity that differs from the original session user", async () => {
    const fake = serverClient({
      verified: { data: { user: { id: "22222222-2222-4222-8222-222222222222" } }, error: null },
    });
    mocks.createServerClient.mockResolvedValue(fake.client);
    const gateway = await createSupabaseProfileGateway();

    await expect(gateway.changePassword(passwordInput)).resolves.toBe("invalid-current-password");
    expect(fake.spies.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and globally signs out after matching identity verification", async () => {
    const fake = serverClient();
    mocks.createServerClient.mockResolvedValue(fake.client);
    const gateway = await createSupabaseProfileGateway();

    await expect(gateway.changePassword(passwordInput)).resolves.toBe("changed");
    expect(fake.spies.updateUser).toHaveBeenCalledWith({ password: passwordInput.newPassword });
    expect(fake.spies.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(fake.spies.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      fake.spies.signOut.mock.invocationCallOrder[0],
    );
  });

  it.each(["returned error", "thrown error"])(
    "tries local sign-out when global sign-out has a %s",
    async (failureKind) => {
      const fake = serverClient({
        globalLogout: { error: failureKind === "returned error" ? { message: "secret logout error" } : null },
      });
      if (failureKind === "thrown error") {
        fake.spies.signOut
          .mockRejectedValueOnce(new Error("secret logout exception"))
          .mockResolvedValueOnce({ error: null });
      }
      mocks.createServerClient.mockResolvedValue(fake.client);
      const gateway = await createSupabaseProfileGateway();

      await expect(gateway.changePassword(passwordInput)).resolves.toBe("changed");
      expect(fake.spies.signOut).toHaveBeenNthCalledWith(1, { scope: "global" });
      expect(fake.spies.signOut).toHaveBeenNthCalledWith(2, { scope: "local" });
    },
  );

  it("returns unauthenticated before password verification when the session has no email", async () => {
    const fake = serverClient({
      current: { data: { user: { id: user.id, email: "" } }, error: null },
    });
    mocks.createServerClient.mockResolvedValue(fake.client);
    const gateway = await createSupabaseProfileGateway();

    await expect(gateway.changePassword(passwordInput)).resolves.toBe("unauthenticated");
    expect(fake.spies.signInWithPassword).not.toHaveBeenCalled();
  });

  it("converts client creation and auth-call exceptions to error results", async () => {
    mocks.createServerClient.mockRejectedValueOnce(new Error("secret client setup"));
    const fallbackGateway = await createSupabaseProfileGateway();
    await expect(fallbackGateway.updateProfile(profileInput)).resolves.toBe("error");
    await expect(fallbackGateway.changePassword(passwordInput)).resolves.toBe("error");

    const fake = serverClient();
    fake.spies.getUser.mockRejectedValue(new Error("secret auth failure"));
    mocks.createServerClient.mockResolvedValue(fake.client);
    const gateway = await createSupabaseProfileGateway();
    await expect(gateway.updateProfile(profileInput)).resolves.toBe("error");
    await expect(gateway.changePassword(passwordInput)).resolves.toBe("error");
  });
});

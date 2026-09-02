import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  cookieGet: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet }),
}));
vi.mock("@/shared/config/server-env", () => ({
  getServerEnv: () => ({ SUPABASE_SECRET_KEY: "test-server-secret" }),
}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("@/features/auth/actions", () => ({
  resetPasswordAction: vi.fn(),
}));

import ResetPasswordPage from "@/app/(auth)/reset-password/page";
import { createPasswordRecoveryToken } from "@/features/auth/password-recovery-state";

describe("reset password page access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("redirects a direct visit without a recovery session", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    mocks.createServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    await expect(ResetPasswordPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/forgot-password?invalidLink=1");
  });

  it("renders the form for the user authenticated by a recovery link", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    mocks.cookieGet.mockReturnValue({ value: createPasswordRecoveryToken(userId) });
    mocks.createServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId } },
          error: null,
        }),
      },
    });

    render(await ResetPasswordPage());

    expect(screen.getByRole("heading", { name: "새 비밀번호 설정" })).toBeVisible();
    expect(screen.getByRole("button", { name: "비밀번호 변경" })).toBeVisible();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

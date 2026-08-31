import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/shared/config/env", () => ({
  getPublicEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://pockelog.vercel.app" }),
}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("@/features/auth/supabase-gateway", () => ({
  createSupabaseAuthGateway: vi.fn(),
}));

import {
  forgotPasswordAction,
  resetPasswordAction,
} from "@/features/auth/actions";
import { initialAuthActionState } from "@/features/auth/action-state";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("password recovery actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([null, { message: "rate limited" }])(
    "does not reveal whether Supabase accepted the recovery request: %j",
    async (error) => {
      const resetPasswordForEmail = vi.fn().mockResolvedValue({ error });
      mocks.createServerClient.mockResolvedValue({ auth: { resetPasswordForEmail } });

      await expect(forgotPasswordAction(
        initialAuthActionState,
        form({ email: " User@Example.com " }),
      )).resolves.toEqual({
        status: "success",
        message: "가입된 이메일이라면 비밀번호 재설정 링크를 보내드렸습니다.",
      });
      expect(resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
        redirectTo: "https://pockelog.vercel.app/auth/callback?next=/reset-password",
      });
    },
  );

  it("rejects password changes without an authenticated recovery session", async () => {
    const updateUser = vi.fn();
    mocks.createServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        updateUser,
        signOut: vi.fn(),
      },
    });

    await expect(resetPasswordAction(
      initialAuthActionState,
      form({ password: "new-password1!", confirmPassword: "new-password1!" }),
    )).resolves.toEqual({
      status: "error",
      message: "재설정 링크가 만료됐거나 유효하지 않습니다. 링크를 다시 요청해 주세요.",
    });
    expect(updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("signs out the recovery session and returns to login after changing the password", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mocks.createServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
          error: null,
        }),
        updateUser,
        signOut,
      },
    });

    await resetPasswordAction(
      initialAuthActionState,
      form({ password: "new-password1!", confirmPassword: "new-password1!" }),
    );

    expect(updateUser).toHaveBeenCalledWith({ password: "new-password1!" });
    expect(signOut).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login?passwordReset=1");
  });
});

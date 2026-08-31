import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("@/shared/config/server-env", () => ({
  getServerEnv: () => ({ SUPABASE_SECRET_KEY: "test-server-secret" }),
}));

import { GET } from "@/app/auth/callback/route";

describe("auth callback", () => {
  beforeEach(() => vi.resetAllMocks());

  it("sends an invalid recovery callback back to the reset-request screen", async () => {
    mocks.createServerClient.mockResolvedValue({
      auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "expired" } }) },
    });
    const request = new NextRequest(
      "https://pockelog.vercel.app/auth/callback?code=expired&next=/reset-password",
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "https://pockelog.vercel.app/forgot-password?invalidLink=1",
    );
  });

  it("marks a successful recovery callback with a short-lived HttpOnly cookie", async () => {
    mocks.createServerClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
          error: null,
        }),
      },
    });
    const request = new NextRequest(
      "https://pockelog.vercel.app/auth/callback?code=recovery-code&next=/reset-password",
    );

    const response = await GET(request);
    const recoveryCookie = response.cookies.get("pockelog-password-recovery");

    expect(response.headers.get("location")).toBe(
      "https://pockelog.vercel.app/reset-password",
    );
    expect(recoveryCookie?.value).toBeTruthy();
    expect(recoveryCookie?.httpOnly).toBe(true);
    expect(recoveryCookie?.sameSite).toBe("lax");
    expect(recoveryCookie?.path).toBe("/reset-password");
    expect(recoveryCookie?.maxAge).toBe(900);
  });
});

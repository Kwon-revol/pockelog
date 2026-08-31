import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));

vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
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
});

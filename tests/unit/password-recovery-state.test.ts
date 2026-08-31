import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/config/server-env", () => ({
  getServerEnv: () => ({ SUPABASE_SECRET_KEY: "test-server-secret" }),
}));

import {
  createPasswordRecoveryToken,
  isValidPasswordRecoveryToken,
} from "@/features/auth/password-recovery-state";

describe("password recovery state", () => {
  const issuedAt = Date.UTC(2026, 7, 31, 6, 0, 0);
  const userId = "11111111-1111-4111-8111-111111111111";

  it("accepts the intended user before the marker expires", () => {
    const token = createPasswordRecoveryToken(userId, issuedAt);

    expect(isValidPasswordRecoveryToken(token, userId, issuedAt + 14 * 60 * 1000)).toBe(true);
  });

  it("rejects another user, an expired marker, and a modified signature", () => {
    const token = createPasswordRecoveryToken(userId, issuedAt);
    const [payload] = token.split(".");

    expect(isValidPasswordRecoveryToken(
      token,
      "22222222-2222-4222-8222-222222222222",
      issuedAt,
    )).toBe(false);
    expect(isValidPasswordRecoveryToken(token, userId, issuedAt + 15 * 60 * 1000)).toBe(false);
    expect(isValidPasswordRecoveryToken(`${payload}.invalid`, userId, issuedAt)).toBe(false);
  });
});

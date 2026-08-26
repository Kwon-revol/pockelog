import { describe, expect, it } from "vitest";

import {
  AUTHENTICATION_ERROR_MESSAGE,
  loginWithGateway,
  safeNextPath,
  signupWithGateway,
  type AuthGateway,
} from "@/features/auth/auth-workflows";

const signupInput = {
  loginId: "daily_user",
  password: "password1!",
  confirmPassword: "password1!",
  displayName: "생활 기록자",
  email: "user@example.com",
  phone: "01012345678",
};

function createGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    async signUp() {
      return { error: false, hasSession: true };
    },
    async resolveLoginEmail(loginId) {
      return loginId === "daily_user" ? "user@example.com" : null;
    },
    async signInWithPassword(email, password) {
      return {
        error: email !== "user@example.com" || password !== "password1!",
      };
    },
    async signOut() {},
    ...overrides,
  };
}

describe("signupWithGateway", () => {
  it("returns a signed-in result when Supabase creates a session", async () => {
    await expect(signupWithGateway(signupInput, createGateway())).resolves.toEqual(
      { status: "authenticated" },
    );
  });

  it("returns an email confirmation result when signup has no session", async () => {
    const gateway = createGateway({
      async signUp() {
        return { error: false, hasSession: false };
      },
    });

    await expect(signupWithGateway(signupInput, gateway)).resolves.toEqual({
      status: "confirmation-required",
    });
  });
});

describe("loginWithGateway", () => {
  it("resolves a login ID to an email before password login", async () => {
    await expect(
      loginWithGateway(
        { identifier: "daily_user", password: "password1!" },
        createGateway(),
      ),
    ).resolves.toEqual({ status: "authenticated" });
  });

  it("uses the same message for a missing account and a wrong password", async () => {
    const attemptedEmails: string[] = [];
    const gateway = createGateway({
      async signInWithPassword(email) {
        attemptedEmails.push(email);
        return { error: true };
      },
    });

    const missing = await loginWithGateway(
      { identifier: "missing_user", password: "password1!" },
      gateway,
    );
    const wrongPassword = await loginWithGateway(
      { identifier: "user@example.com", password: "wrong-password" },
      gateway,
    );

    expect(missing).toEqual({
      status: "error",
      message: AUTHENTICATION_ERROR_MESSAGE,
    });
    expect(wrongPassword).toEqual(missing);
    expect(attemptedEmails).toHaveLength(2);
    expect(attemptedEmails[0]).toMatch(/@invalid\.pockelog\.test$/);
    expect(attemptedEmails[1]).toBe("user@example.com");
  });
});

describe("safeNextPath", () => {
  it("keeps an internal application path", () => {
    expect(safeNextPath("/statistics?period=2026-08")).toBe(
      "/statistics?period=2026-08",
    );
  });

  it.each(["https://evil.example", "//evil.example", "javascript:alert(1)"])(
    "rejects the external redirect %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/ledger");
    },
  );
});

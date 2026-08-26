import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/features/auth/schemas";

const validSignup = {
  loginId: "daily_user",
  password: "password1!",
  confirmPassword: "password1!",
  displayName: "  생활 기록자  ",
  email: " User@Example.com ",
  phone: "010-1234-5678",
};

describe("signupSchema", () => {
  it("normalizes account data before signup", () => {
    expect(signupSchema.parse(validSignup)).toEqual({
      loginId: "daily_user",
      password: "password1!",
      confirmPassword: "password1!",
      displayName: "생활 기록자",
      email: "user@example.com",
      phone: "01012345678",
    });
  });

  it("rejects a password confirmation that does not match", () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      confirmPassword: "different1!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain(
        "비밀번호가 일치하지 않습니다.",
      );
    }
  });
});

describe("loginSchema", () => {
  it("normalizes an email identifier without changing the password", () => {
    expect(
      loginSchema.parse({
        identifier: " User@Example.com ",
        password: "password1!",
      }),
    ).toEqual({ identifier: "user@example.com", password: "password1!" });
  });

  it("rejects an identifier that is neither a login ID nor an email", () => {
    expect(
      loginSchema.safeParse({ identifier: "사용자 이름", password: "password1!" })
        .success,
    ).toBe(false);
  });
});

describe("password reset schemas", () => {
  it("normalizes the recovery email", () => {
    expect(forgotPasswordSchema.parse({ email: " User@Example.com " })).toEqual({
      email: "user@example.com",
    });
  });

  it("rejects mismatched replacement passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "new-password1!",
      confirmPassword: "different-password1!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain(
        "비밀번호가 일치하지 않습니다.",
      );
    }
  });
});

import { describe, expect, it } from "vitest";

import {
  getAuthRedirect,
  isPublicPath,
} from "@/shared/supabase/auth-routing";

describe("isPublicPath", () => {
  it.each(["/", "/login", "/signup", "/forgot-password", "/auth/callback"])(
    "allows the public path %s",
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(true);
    },
  );

  it.each(["/ledger", "/statistics", "/tax-goals", "/settings"])(
    "protects the application path %s",
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(false);
    },
  );
});

describe("getAuthRedirect", () => {
  it("preserves the requested application URL for a signed-out user", () => {
    expect(getAuthRedirect("/statistics?period=2026-08", false)).toBe(
      "/login?next=%2Fstatistics%3Fperiod%3D2026-08",
    );
  });

  it("moves a signed-in user away from a guest-only screen", () => {
    expect(getAuthRedirect("/login", true)).toBe("/ledger");
  });

  it("does not redirect a signed-in user on the landing page", () => {
    expect(getAuthRedirect("/", true)).toBeNull();
  });
});

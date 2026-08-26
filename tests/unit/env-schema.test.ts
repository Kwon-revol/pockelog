import { describe, expect, it } from "vitest";

import {
  parsePublicEnv,
  parseServerEnv,
} from "@/shared/config/env-schema";

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("parsePublicEnv", () => {
  it("returns only browser-safe environment values", () => {
    expect(
      parsePublicEnv({
        ...validPublicEnv,
        SUPABASE_SECRET_KEY: "must-not-leak",
      }),
    ).toEqual(validPublicEnv);
  });
});

describe("parseServerEnv", () => {
  it("rejects a missing Supabase secret key", () => {
    expect(() => parseServerEnv({})).toThrow();
  });

  it("returns the server-only Supabase secret key", () => {
    expect(
      parseServerEnv({ SUPABASE_SECRET_KEY: "sb_secret_example" }),
    ).toEqual({ SUPABASE_SECRET_KEY: "sb_secret_example" });
  });
});

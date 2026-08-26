import { describe, expect, it } from "vitest";

import {
  assertDestructiveE2EAllowed,
  assertExpectedProjectHost,
} from "../e2e/safety";

describe("hosted Supabase E2E safety", () => {
  it("rejects a URL that does not match the explicitly named project", () => {
    expect(() =>
      assertExpectedProjectHost(
        "https://production.supabase.co",
        "development",
      ),
    ).toThrow(/project mismatch/i);
  });

  it("requires the database-owned destructive-test marker", async () => {
    await expect(
      assertDestructiveE2EAllowed(async () => false),
    ).rejects.toThrow(/database marker/i);
    await expect(
      assertDestructiveE2EAllowed(async () => true),
    ).resolves.toBeUndefined();
  });
});

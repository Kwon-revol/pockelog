import { describe, expect, it } from "vitest";

import { normalizePhone } from "@/shared/domain/phone";

describe("normalizePhone", () => {
  it("removes formatting characters before a phone number is stored", () => {
    expect(normalizePhone("010-1234 5678")).toBe("01012345678");
  });
});

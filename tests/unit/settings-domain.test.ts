import { describe, expect, it } from "vitest";

import {
  formDataToCategoryInput,
  formDataToLedgerSettingsInput,
} from "@/features/settings/schemas";

describe("settings input schemas", () => {
  it("normalizes a valid ledger name and last-day period", () => {
    const data = new FormData();
    data.set("name", "  우리 집 장부  ");
    data.set("periodStartDay", "last");

    const result = formDataToLedgerSettingsInput(data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "우리 집 장부", periodStartDay: null });
    }
  });

  it.each(["0", "29", "wrong"])("rejects an unsupported period start value: %s", (value) => {
    const data = new FormData();
    data.set("name", "내 장부");
    data.set("periodStartDay", value);

    const result = formDataToLedgerSettingsInput(data);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.periodStartDay).toBeDefined();
    }
  });

  it("rejects an empty ledger name", () => {
    const data = new FormData();
    data.set("name", "   ");
    data.set("periodStartDay", "1");

    const result = formDataToLedgerSettingsInput(data);

    expect(result.success).toBe(false);
  });

  it("normalizes a valid category and rejects malformed colors", () => {
    const valid = new FormData();
    valid.set("type", "expense");
    valid.set("name", "  반려동물  ");
    valid.set("color", "#a1b2c3");

    const validResult = formDataToCategoryInput(valid);
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data).toEqual({ type: "expense", name: "반려동물", color: "#A1B2C3" });
    }

    const invalid = new FormData();
    invalid.set("type", "income");
    invalid.set("name", "부수입");
    invalid.set("color", "green");
    expect(formDataToCategoryInput(invalid).success).toBe(false);
  });
});

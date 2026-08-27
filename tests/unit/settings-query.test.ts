import { describe, expect, it } from "vitest";

import {
  mapCategoryUpdateResult,
  resolveNextCategorySortOrder,
} from "@/features/settings/gateway-utils";
import { mapSettingsPageData } from "@/features/settings/query-utils";

describe("settings query mapping", () => {
  it("maps owner role and sorts categories by type, order, and name", () => {
    const result = mapSettingsPageData(
      { id: "ledger-1", name: "내 장부", period_start_day: 10 },
      { role: "owner" },
      [
        { id: "3", type: "expense", name: "취미", color: "#8B5CF6", sort_order: 2, is_active: false },
        { id: "1", type: "income", name: "급여", color: "#10B981", sort_order: 0, is_active: true },
        { id: "2", type: "expense", name: "식비", color: "#F97316", sort_order: 0, is_active: true },
        { id: "4", type: "expense", name: "교통", color: "#3B82F6", sort_order: 2, is_active: true },
      ],
    );

    expect(result.ledger).toEqual({ id: "ledger-1", name: "내 장부", periodStartDay: 10 });
    expect(result.isOwner).toBe(true);
    expect(result.categories.map((category) => category.id)).toEqual(["2", "4", "3", "1"]);
    expect(result.categories[2]).toMatchObject({ name: "취미", isActive: false, sortOrder: 2 });
  });

  it("keeps a member in read-only mode and accepts a last-day period", () => {
    const result = mapSettingsPageData(
      { id: "ledger-1", name: "공동 장부", period_start_day: null },
      { role: "member" },
      [],
    );

    expect(result.isOwner).toBe(false);
    expect(result.ledger.periodStartDay).toBeNull();
  });
});

describe("settings gateway mapping", () => {
  it("increments the last category order and stops when the lookup failed", () => {
    expect(resolveNextCategorySortOrder({ sort_order: 4 }, null)).toBe(5);
    expect(resolveNextCategorySortOrder(null, null)).toBe(0);
    expect(resolveNextCategorySortOrder(null, { code: "PGRST001" })).toBeNull();
  });

  it("distinguishes missing rows, authorization failures, and server errors", () => {
    expect(mapCategoryUpdateResult(null, true)).toBe("updated");
    expect(mapCategoryUpdateResult(null, false)).toBe("forbidden");
    expect(mapCategoryUpdateResult("42501", false)).toBe("forbidden");
    expect(mapCategoryUpdateResult("23505", false)).toBe("duplicate");
    expect(mapCategoryUpdateResult("XX000", false)).toBe("error");
  });
});

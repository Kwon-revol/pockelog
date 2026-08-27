import { describe, expect, it } from "vitest";

import {
  getLedgerPeriodFromStart,
  listLedgerPeriods,
} from "@/features/transactions/period";

describe("statistics settlement periods", () => {
  it("lists the current and prior periods for a configured start day", () => {
    expect(
      listLedgerPeriods(new Date("2026-08-26T12:00:00+09:00"), 10, 3),
    ).toEqual([
      { key: "2026-08-10", startOn: "2026-08-10", endOn: "2026-09-09", endExclusive: "2026-09-10" },
      { key: "2026-07-10", startOn: "2026-07-10", endOn: "2026-08-09", endExclusive: "2026-08-10" },
      { key: "2026-06-10", startOn: "2026-06-10", endOn: "2026-07-09", endExclusive: "2026-07-10" },
    ]);
  });

  it("uses real month ends across a leap year", () => {
    expect(getLedgerPeriodFromStart("2028-02-29", null)).toEqual({
      key: "2028-02-29",
      startOn: "2028-02-29",
      endOn: "2028-03-30",
      endExclusive: "2028-03-31",
    });
    expect(getLedgerPeriodFromStart("2028-02-28", null)).toBeNull();
  });

  it("rejects invalid keys and unsupported counts", () => {
    expect(getLedgerPeriodFromStart("2026-99-99", 1)).toBeNull();
    expect(() => listLedgerPeriods(new Date(), 1, 0)).toThrow("period count");
  });
});

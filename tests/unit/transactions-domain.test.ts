import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "@/features/transactions/cursor";
import { getLedgerPeriod } from "@/features/transactions/period";
import {
  normalizeTransactionFilters,
  transactionFormSchema,
} from "@/features/transactions/schemas";

const defaults = {
  startOn: "2026-08-01",
  endOn: "2026-08-31",
  endExclusive: "2026-09-01",
};

describe("getLedgerPeriod", () => {
  it("uses the configured settlement day across a leap-year boundary", () => {
    expect(
      getLedgerPeriod(new Date("2028-02-29T03:00:00+09:00"), 10),
    ).toEqual({
      startOn: "2028-02-10",
      endOn: "2028-03-09",
      endExclusive: "2028-03-10",
    });
  });

  it("uses month ends when the settlement day is null", () => {
    expect(
      getLedgerPeriod(new Date("2026-08-31T12:00:00+09:00"), null),
    ).toEqual({
      startOn: "2026-08-31",
      endOn: "2026-09-29",
      endExclusive: "2026-09-30",
    });
  });

  it("uses the previous period before this month's settlement day", () => {
    expect(
      getLedgerPeriod(new Date("2027-01-03T12:00:00+09:00"), 10),
    ).toEqual({
      startOn: "2026-12-10",
      endOn: "2027-01-09",
      endExclusive: "2027-01-10",
    });
  });
});

describe("transaction input", () => {
  it("normalizes URL filters and falls back from unsupported choices", () => {
    expect(
      normalizeTransactionFilters(
        { type: "invalid", q: "  점심  ", sort: "oldest" },
        defaults,
      ),
    ).toEqual({
      ...defaults,
      query: "점심",
      type: "all",
      categoryId: null,
      sort: "oldest",
    });
  });

  it("uses defaults when a custom date range is reversed", () => {
    expect(
      normalizeTransactionFilters(
        { start: "2026-09-01", end: "2026-08-01" },
        defaults,
      ),
    ).toMatchObject(defaults);
  });

  it("rejects zero won and accepts a trimmed positive transaction", () => {
    const base = {
      type: "expense",
      occurredOn: "2026-08-26",
      description: "  점심  ",
      categoryId: "11111111-1111-4111-8111-111111111111",
      memo: "  동료와 식사  ",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
    };

    expect(transactionFormSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(transactionFormSchema.parse({ ...base, amount: "12500" })).toEqual({
      ...base,
      description: "점심",
      memo: "동료와 식사",
      amount: 12500,
    });
  });
});

describe("transaction cursor", () => {
  it("round-trips the complete stable sorting key", () => {
    const cursor = {
      occurredOn: "2026-08-26",
      createdAt: "2026-08-26T01:02:03.000Z",
      id: "11111111-1111-4111-8111-111111111111",
    };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed or incomplete cursors", () => {
    expect(decodeCursor("broken")).toBeNull();
    expect(
      decodeCursor(
        Buffer.from(JSON.stringify({ occurredOn: "2026-08-26" })).toString("base64url"),
      ),
    ).toBeNull();
  });
});

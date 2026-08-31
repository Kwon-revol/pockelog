import { z } from "zod";

import { isValidDateString } from "@/features/transactions/period";
import type { TaxCursor } from "@/features/tax/types";

const cursorSchema = z.strictObject({
  occurredOn: z.string().refine(isValidDateString),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

const base64Url = /^[A-Za-z0-9_-]+$/;

export function encodeTaxCursor(cursor: TaxCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeTaxCursor(
  value: string | null | undefined,
  expectedYear: number,
): TaxCursor | null {
  if (!value || !base64Url.test(value) || !Number.isInteger(expectedYear)) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) return null;
    const result = cursorSchema.safeParse(JSON.parse(bytes.toString("utf8")));
    if (!result.success) return null;
    const startOn = `${expectedYear}-01-01`;
    const endExclusive = `${expectedYear + 1}-01-01`;
    return result.data.occurredOn >= startOn && result.data.occurredOn < endExclusive
      ? result.data
      : null;
  } catch {
    return null;
  }
}

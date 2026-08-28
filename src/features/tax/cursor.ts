import { z } from "zod";

import { isValidDateString } from "@/features/transactions/period";
import type { TaxCursor } from "@/features/tax/types";

const cursorSchema = z.object({
  occurredOn: z.string().refine(isValidDateString),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

const base64Url = /^[A-Za-z0-9_-]+$/;

export function encodeTaxCursor(cursor: TaxCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeTaxCursor(value: string | null | undefined): TaxCursor | null {
  if (!value || !base64Url.test(value)) return null;
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.toString("base64url") !== value) return null;
    const result = cursorSchema.safeParse(JSON.parse(bytes.toString("utf8")));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

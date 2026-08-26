import { z } from "zod";

import { isValidDateString } from "@/features/transactions/period";
import type { TransactionCursor } from "@/features/transactions/types";

const cursorSchema = z.object({
  occurredOn: z.string().refine(isValidDateString),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

export function encodeCursor(cursor: TransactionCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string | null | undefined): TransactionCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const result = cursorSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

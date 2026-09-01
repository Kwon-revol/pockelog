import { z } from "zod";

const cursorSchema = z.object({
  deletedAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

export type TrashCursor = z.infer<typeof cursorSchema>;

export function encodeTrashCursor(cursor: TrashCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeTrashCursor(value: string): TrashCursor | null {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") !== value) return null;
    const parsed = JSON.parse(decoded.toString("utf8"));
    const result = cursorSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

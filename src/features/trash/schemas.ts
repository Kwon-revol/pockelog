import { z } from "zod";
import { decodeTrashCursor } from "@/features/trash/cursor";

export const trashTransactionIdSchema = z.string().uuid();

export const trashPageParamsSchema = z.object({
  cursor: z.string().optional(),
}).refine((params) => params.cursor === undefined || decodeTrashCursor(params.cursor) !== null, {
  path: ["cursor"],
  message: "Invalid trash cursor",
});

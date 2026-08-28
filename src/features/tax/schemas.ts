import { z } from "zod";

import { getTaxRule } from "@/features/tax/rules";

export const taxProfileFormSchema = z.object({
  taxYear: z.coerce.number().int().refine((year) => getTaxRule(year) !== null),
  grossSalary: z
    .string()
    .transform((value) => Number(value.replaceAll(",", "")))
    .pipe(z.number().int().nonnegative().safe()),
});

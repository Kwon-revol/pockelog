import { z } from "zod";

import { getTaxRule } from "@/features/tax/rules";

export const taxProfileFormSchema = z.object({
  taxYear: z.coerce.number().int().refine((year) => getTaxRule(year) !== null),
  grossSalary: z
    .string()
    .trim()
    .refine((value) => value.replaceAll(",", "").length > 0, {
      message: "총급여를 입력해 주세요.",
    })
    .transform((value) => Number(value.replaceAll(",", "")))
    .pipe(z.number().int().nonnegative().safe()),
});

import { z } from "zod";

const periodStartDaySchema = z
  .string()
  .refine(
    (value) => value === "last" || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 28),
    "정산 시작일은 1일부터 28일 또는 말일 중에서 선택해 주세요.",
  )
  .transform((value) => value === "last" ? null : Number(value));

export const ledgerSettingsFormSchema = z.object({
  name: z.string().trim().min(1, "장부 이름을 입력해 주세요.").max(50, "장부 이름은 50자 이하로 입력해 주세요."),
  periodStartDay: periodStartDaySchema,
});

export const categoryFormSchema = z.object({
  type: z.enum(["income", "expense"], { message: "수입 또는 지출을 선택해 주세요." }),
  name: z.string().trim().min(1, "분류 이름을 입력해 주세요.").max(30, "분류 이름은 30자 이하로 입력해 주세요."),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "분류 색상을 선택해 주세요.").transform((value) => value.toUpperCase()),
});

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

export function formDataToLedgerSettingsInput(formData: FormData) {
  return ledgerSettingsFormSchema.safeParse({
    name: value(formData, "name"),
    periodStartDay: value(formData, "periodStartDay"),
  });
}

export function formDataToCategoryInput(formData: FormData) {
  return categoryFormSchema.safeParse({
    type: value(formData, "type"),
    name: value(formData, "name"),
    color: value(formData, "color"),
  });
}

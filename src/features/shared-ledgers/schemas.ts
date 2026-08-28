import { z } from "zod";

export const sharedLedgerNameSchema = z
  .string()
  .trim()
  .min(1, "공동 장부 이름을 입력해 주세요.")
  .max(50, "공동 장부 이름은 50자 이하로 입력해 주세요.");

export const invitationIdentifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (value) => z.email().safeParse(value).success || /^[a-z0-9_]{4,20}$/.test(value),
    "가입한 사용자의 아이디 또는 이메일을 입력해 주세요.",
  );

export const idSchema = z.uuid();

export const deleteSharedLedgerSchema = z.object({
  ledgerId: idSchema,
  confirmationName: sharedLedgerNameSchema,
});

export const createSharedLedgerSchema = z.object({ name: sharedLedgerNameSchema });
export const inviteLedgerMemberSchema = z.object({
  ledgerId: idSchema,
  identifier: invitationIdentifierSchema,
});

export function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

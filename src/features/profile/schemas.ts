import { z } from "zod";

import { normalizePhone } from "@/shared/domain/phone";

export const profileFormSchema = z.object({
  displayName: z.string().trim().min(1, "이름을 입력해 주세요.").max(30, "이름은 30자 이하로 입력해 주세요."),
  phone: z.string().trim().regex(/^[0-9-]+$/, "전화번호 형식을 확인해 주세요.").transform(normalizePhone),
});

export const passwordChangeFormSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
  newPassword: z.string().min(1, "새 비밀번호를 입력해 주세요."),
  confirmPassword: z.string(),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "새 비밀번호가 일치하지 않습니다.",
  path: ["confirmPassword"],
}).transform(({ currentPassword, newPassword }) => ({ currentPassword, newPassword }));

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

export function formDataToProfileInput(formData: FormData) {
  return profileFormSchema.safeParse({
    displayName: value(formData, "displayName"),
    phone: value(formData, "phone"),
  });
}

export function formDataToPasswordChangeInput(formData: FormData) {
  return passwordChangeFormSchema.safeParse({
    currentPassword: value(formData, "currentPassword"),
    newPassword: value(formData, "newPassword"),
    confirmPassword: value(formData, "confirmPassword"),
  });
}

import { z } from "zod";

import { normalizePhone } from "@/shared/domain/phone";

const loginIdPattern = /^[a-z0-9_]{4,20}$/;

export const loginIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    loginIdPattern,
    "아이디는 영문 소문자, 숫자, 밑줄로 4~20자 입력해 주세요.",
  );

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("올바른 이메일 주소를 입력해 주세요.");

const passwordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상 입력해 주세요.");

const phoneSchema = z
  .string()
  .trim()
  .min(1, "전화번호를 입력해 주세요.")
  .regex(/^[0-9-]+$/, "전화번호는 숫자와 하이픈만 입력해 주세요.")
  .transform(normalizePhone);

export const signupSchema = z
  .object({
    loginId: loginIdSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    displayName: z
      .string()
      .trim()
      .min(1, "사용자명을 입력해 주세요.")
      .max(30, "사용자명은 30자 이하로 입력해 주세요."),
    email: emailSchema,
    phone: phoneSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) =>
        loginIdPattern.test(value) || emailSchema.safeParse(value).success,
      "아이디 또는 이메일을 입력해 주세요.",
    ),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

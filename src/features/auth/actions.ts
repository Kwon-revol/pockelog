"use server";

import { redirect } from "next/navigation";

import type { AuthActionState } from "@/features/auth/action-state";
import {
  loginWithGateway,
  safeNextPath,
  signupWithGateway,
} from "@/features/auth/auth-workflows";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/features/auth/schemas";
import { getPublicEnv } from "@/shared/config/env";
import { createServerClient } from "@/shared/supabase/server";
import { createSupabaseAuthGateway } from "@/features/auth/supabase-gateway";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    loginId: formValue(formData, "loginId"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
    displayName: formValue(formData, "displayName"),
    email: formValue(formData, "email"),
    phone: formValue(formData, "phone"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "입력한 내용을 확인해 주세요.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const gateway = await createSupabaseAuthGateway();
  const result = await signupWithGateway(parsed.data, gateway);

  if (result.status === "authenticated") {
    redirect("/ledger");
  }

  if (result.status === "confirmation-required") {
    return {
      status: "confirmation-required",
      message: "확인 메일을 보냈습니다. 이메일의 링크를 열어 가입을 완료해 주세요.",
    };
  }

  return result;
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formValue(formData, "identifier"),
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "입력한 내용을 확인해 주세요.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const gateway = await createSupabaseAuthGateway();
  const result = await loginWithGateway(parsed.data, gateway);

  if (result.status === "authenticated") {
    redirect(safeNextPath(formValue(formData, "next")));
  }

  return result;
}

export async function logoutAction() {
  const gateway = await createSupabaseAuthGateway();
  await gateway.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formValue(formData, "email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "입력한 내용을 확인해 주세요.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const env = getPublicEnv();
  try {
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
    });
  } catch {
    // Keep the response identical so account existence and provider state stay private.
  }

  return {
    status: "success",
    message: "가입된 이메일이라면 비밀번호 재설정 링크를 보내드렸습니다.",
  };
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "입력한 내용을 확인해 주세요.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      status: "error",
      message: "재설정 링크가 만료됐거나 유효하지 않습니다. 링크를 다시 요청해 주세요.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: "재설정 링크가 만료됐거나 유효하지 않습니다. 링크를 다시 요청해 주세요.",
    };
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // The password is already changed; the login screen remains the safe destination.
  }
  redirect("/login?passwordReset=1");
}

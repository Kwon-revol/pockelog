"use client";

import Link from "next/link";
import { useActionState } from "react";

import { initialAuthActionState } from "@/features/auth/action-state";
import { forgotPasswordAction } from "@/features/auth/actions";
import { FormField } from "@/shared/ui/form-field";
import { SubmitButton } from "@/shared/ui/submit-button";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    initialAuthActionState,
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormField
        label="가입 이메일"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="name@example.com"
        errors={state.fieldErrors?.email}
      />

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
            state.status === "error"
              ? "bg-rose-50 text-rose-700"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton>재설정 링크 받기</SubmitButton>
      <Link href="/login" className="block text-center text-sm font-bold text-emerald-700">
        로그인으로 돌아가기
      </Link>
    </form>
  );
}

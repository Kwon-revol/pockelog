"use client";

import Link from "next/link";
import { useActionState } from "react";

import { initialAuthActionState } from "@/features/auth/action-state";
import { resetPasswordAction } from "@/features/auth/actions";
import { FormField } from "@/shared/ui/form-field";
import { SubmitButton } from "@/shared/ui/submit-button";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(
    resetPasswordAction,
    initialAuthActionState,
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormField
        label="새 비밀번호"
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder="8자 이상"
        errors={state.fieldErrors?.password}
      />
      <FormField
        label="새 비밀번호 확인"
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder="한 번 더 입력"
        errors={state.fieldErrors?.confirmPassword}
      />

      {state.message ? (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}

      <SubmitButton>비밀번호 변경</SubmitButton>
      <Link href="/forgot-password" className="block text-center text-sm font-bold text-emerald-700">
        새 재설정 링크 요청하기
      </Link>
    </form>
  );
}

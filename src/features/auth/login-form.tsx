"use client";

import Link from "next/link";
import { useActionState } from "react";

import { initialAuthActionState } from "@/features/auth/action-state";
import { loginAction } from "@/features/auth/actions";
import { FormField } from "@/shared/ui/form-field";
import { SubmitButton } from "@/shared/ui/submit-button";

export function LoginForm({
  nextPath = "/ledger",
  notice,
}: {
  nextPath?: string;
  notice?: string;
}) {
  const [state, formAction] = useActionState(loginAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={nextPath} />
      {notice ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}
      <FormField
        label="아이디 또는 이메일"
        id="identifier"
        name="identifier"
        type="text"
        autoComplete="username"
        required
        placeholder="아이디 또는 이메일"
        errors={state.fieldErrors?.identifier}
      />
      <FormField
        label="비밀번호"
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="비밀번호"
        errors={state.fieldErrors?.password}
      />

      {state.message ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton>로그인</SubmitButton>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="font-semibold text-slate-500 hover:text-slate-800">
          비밀번호 찾기
        </Link>
        <Link href="/signup" className="font-bold text-emerald-700 hover:text-emerald-800">
          회원가입
        </Link>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";

import { initialAuthActionState } from "@/features/auth/action-state";
import { signupAction } from "@/features/auth/actions";
import { FormField } from "@/shared/ui/form-field";
import { SubmitButton } from "@/shared/ui/submit-button";

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormField
        label="아이디"
        id="loginId"
        name="loginId"
        autoComplete="username"
        required
        minLength={4}
        maxLength={20}
        placeholder="영문 소문자, 숫자, 밑줄 4~20자"
        errors={state.fieldErrors?.loginId}
      />
      <FormField
        label="사용자명"
        id="displayName"
        name="displayName"
        autoComplete="name"
        required
        maxLength={30}
        placeholder="앱에 표시할 이름"
        errors={state.fieldErrors?.displayName}
      />
      <FormField
        label="이메일"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="name@example.com"
        errors={state.fieldErrors?.email}
      />
      <FormField
        label="전화번호"
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        placeholder="010-1234-5678"
        errors={state.fieldErrors?.phone}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="비밀번호"
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
          label="비밀번호 확인"
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="한 번 더 입력"
          errors={state.fieldErrors?.confirmPassword}
        />
      </div>

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

      <p className="text-xs leading-5 text-slate-500">
        가입하면 입력한 정보를 계정과 장부 운영 목적으로 사용하는 데 동의한 것으로 봅니다.
      </p>

      <SubmitButton>가입하기</SubmitButton>

      <p className="text-center text-sm text-slate-500">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-bold text-emerald-700 hover:text-emerald-800">
          로그인
        </Link>
      </p>
    </form>
  );
}

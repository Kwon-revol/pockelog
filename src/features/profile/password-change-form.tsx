"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  initialProfileActionState,
  type ProfileFormAction,
} from "@/features/profile/types";
import { FormField } from "@/shared/ui/form-field";
import { SubmitButton } from "@/shared/ui/submit-button";

function PasswordFields({ fieldErrors }: { fieldErrors?: Record<string, string[] | undefined> }) {
  const { pending } = useFormStatus();

  return (
    <fieldset className="space-y-4" disabled={pending}>
      <FormField
        autoComplete="current-password"
        errors={fieldErrors?.currentPassword}
        label="현재 비밀번호"
        name="currentPassword"
        required
        type="password"
      />
      <FormField
        autoComplete="new-password"
        errors={fieldErrors?.newPassword}
        label="새 비밀번호"
        minLength={8}
        name="newPassword"
        required
        type="password"
      />
      <FormField
        autoComplete="new-password"
        errors={fieldErrors?.confirmPassword}
        label="새 비밀번호 확인"
        minLength={8}
        name="confirmPassword"
        required
        type="password"
      />
      <SubmitButton>비밀번호 변경</SubmitButton>
    </fieldset>
  );
}

export function PasswordChangeForm({ action }: { action: ProfileFormAction }) {
  const [state, formAction] = useActionState(action, initialProfileActionState);

  return (
    <section aria-labelledby="password-change-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">보안</p>
        <h2 className="mt-1 text-xl font-black text-slate-950" id="password-change-title">비밀번호 변경</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">비밀번호를 변경하면 모든 기기에서 로그아웃됩니다.</p>
      </div>
      <form action={formAction} noValidate>
        <PasswordFields fieldErrors={state.fieldErrors} />
      </form>
      {state.status === "error" && state.message ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

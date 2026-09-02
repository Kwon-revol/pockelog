"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  initialProfileActionState,
  type ProfileFormAction,
  type ProfilePageData,
} from "@/features/profile/types";
import { FormField } from "@/shared/ui/form-field";
import { SubmitButton } from "@/shared/ui/submit-button";

function formatPhone(phone: string) {
  return /^01[0-9]\d{8}$/.test(phone)
    ? `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`
    : phone;
}

function ProfileFormFields({
  data,
  fieldErrors,
}: {
  data: ProfilePageData;
  fieldErrors?: Record<string, string[] | undefined>;
}) {
  const { pending } = useFormStatus();

  return (
    <fieldset className="space-y-4" disabled={pending}>
      <FormField
        defaultValue={data.displayName}
        errors={fieldErrors?.displayName}
        label="사용자명"
        name="displayName"
        required
      />
      <FormField
        defaultValue={formatPhone(data.phone)}
        errors={fieldErrors?.phone}
        inputMode="tel"
        label="전화번호"
        name="phone"
        required
      />
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="profile-email">가입 이메일</label>
        <input
          aria-label="가입 이메일"
          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-500"
          id="profile-email"
          readOnly
          value={data.email}
        />
      </div>
      <SubmitButton>프로필 저장</SubmitButton>
    </fieldset>
  );
}

export function ProfileForm({
  data,
  action,
}: {
  data: ProfilePageData;
  action: ProfileFormAction;
}) {
  const [state, formAction] = useActionState(action, initialProfileActionState);

  return (
    <section aria-labelledby="profile-form-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">계정 정보</p>
        <h2 className="mt-1 text-xl font-black text-slate-950" id="profile-form-title">내 프로필</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">이름과 연락처는 공동 장부 구성원에게 표시될 수 있습니다.</p>
      </div>
      <form action={formAction} noValidate>
        <ProfileFormFields data={data} fieldErrors={state.fieldErrors} />
      </form>
      {state.message ? (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${state.status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

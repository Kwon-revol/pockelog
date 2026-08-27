"use client";

import { useActionState } from "react";

import {
  initialSettingsActionState,
  type SettingsActionState,
  type SettingsPageData,
} from "@/features/settings/types";
import { SubmitButton } from "@/shared/ui/submit-button";

export type SettingsFormAction = (
  state: SettingsActionState,
  formData: FormData,
) => Promise<SettingsActionState>;

function FieldErrors({ errors }: { errors?: string[] }) {
  return errors?.length ? <p className="mt-1 text-xs font-semibold text-rose-600">{errors[0]}</p> : null;
}

export function LedgerSettingsForm({
  ledger,
  isOwner,
  action,
}: {
  ledger: SettingsPageData["ledger"];
  isOwner: boolean;
  action: SettingsFormAction;
}) {
  const [state, formAction] = useActionState(action, initialSettingsActionState);

  return (
    <section aria-labelledby="ledger-settings-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">장부</p>
        <h2 className="mt-1 text-xl font-black text-slate-950" id="ledger-settings-title">장부 및 정산 기간</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">정산 시작일을 바꾸면 가계부 기본 기간과 월별 통계에 함께 반영됩니다.</p>
      </div>
      <form action={formAction} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.55fr)_auto] sm:items-end" noValidate>
        <label className="text-sm font-bold text-slate-700">
          장부 이름
          <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-medium outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-500" defaultValue={ledger.name} disabled={!isOwner} maxLength={50} name="name" required />
          <FieldErrors errors={state.fieldErrors?.name} />
        </label>
        <label className="text-sm font-bold text-slate-700">
          정산 시작일
          <select className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-500" defaultValue={ledger.periodStartDay?.toString() ?? "last"} disabled={!isOwner} name="periodStartDay">
            {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}일</option>)}
            <option value="last">말일</option>
          </select>
          <FieldErrors errors={state.fieldErrors?.periodStartDay} />
        </label>
        {isOwner ? <SubmitButton>장부 설정 저장</SubmitButton> : null}
      </form>
      {state.message ? <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${state.status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    </section>
  );
}

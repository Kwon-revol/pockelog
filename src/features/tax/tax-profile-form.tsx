"use client";

import { useActionState } from "react";

import type { TaxPageData } from "@/features/tax/types";
import type { TaxActionState } from "@/features/tax/workflows";
import { SubmitButton } from "@/shared/ui/submit-button";

export type TaxProfileFormAction = (
  state: TaxActionState,
  formData: FormData,
) => Promise<TaxActionState>;

const idleState: TaxActionState = { status: "idle" };
const won = new Intl.NumberFormat("ko-KR");

export function TaxProfileForm({
  data,
  action,
}: {
  data: Pick<TaxPageData, "grossSalary" | "supportedYears" | "taxYear">;
  action: TaxProfileFormAction;
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <section aria-labelledby="tax-profile-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">근로소득자</p>
        <h2 className="mt-1 text-xl font-black text-slate-950" id="tax-profile-title">계산 기준</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">과세연도와 원 단위 총급여를 저장하면 예상 세액공제를 계산해요.</p>
      </div>

      <form action={formAction} className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end" noValidate>
        <label className="text-sm font-bold text-slate-700" htmlFor="tax-year">
          과세연도
          <select className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium outline-none focus:border-emerald-500" defaultValue={String(data.taxYear)} id="tax-year" name="taxYear">
            {data.supportedYears.map((year) => <option key={year} value={year}>{year}년</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700" htmlFor="gross-salary">
          총급여
          <span className="relative mt-2 block">
            <input
              className="w-full rounded-2xl border border-slate-200 py-3 pl-4 pr-10 font-medium outline-none focus:border-emerald-500"
              defaultValue={data.grossSalary === null ? "" : won.format(data.grossSalary)}
              id="gross-salary"
              inputMode="numeric"
              name="grossSalary"
              placeholder="예: 50,000,000"
            />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-bold text-slate-400">원</span>
          </span>
          {state.fieldErrors?.grossSalary?.[0] ? <span className="mt-1 block text-xs font-semibold text-rose-600">{state.fieldErrors.grossSalary[0]}</span> : null}
        </label>
        <SubmitButton>총급여 저장</SubmitButton>
      </form>

      {state.message ? (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${state.status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

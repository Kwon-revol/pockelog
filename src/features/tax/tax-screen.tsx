"use client";

import Link from "next/link";

import {
  ContributionList,
  type TaxContributionEditAction,
} from "@/features/tax/contribution-list";
import {
  TaxProfileForm,
  type TaxProfileFormAction,
} from "@/features/tax/tax-profile-form";
import type { LoadContributionPage } from "@/features/tax/use-contribution-pages";
import { useContributionPages } from "@/features/tax/use-contribution-pages";
import type { TaxPageData } from "@/features/tax/types";

const won = new Intl.NumberFormat("ko-KR");
const LAW_URL = "https://law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900470390";
const NTS_URL = "https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875&mi=6596";

function WonValue({ value }: { value: number }) {
  return <>{won.format(value)}원</>;
}

function LimitProgress({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const capped = Math.min(value, max);
  return (
    <div aria-label={label} aria-valuemax={max} aria-valuemin={0} aria-valuenow={capped} className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar">
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
    </div>
  );
}

export function TaxScreen({
  initialData,
  saveProfileAction,
  loadPage,
  editAction,
}: {
  initialData: TaxPageData;
  saveProfileAction: TaxProfileFormAction;
  loadPage?: LoadContributionPage;
  editAction?: TaxContributionEditAction;
}) {
  const pages = useContributionPages(initialData.contributions, initialData.taxYear, loadPage);
  const result = initialData.result;
  const combinedPaid = initialData.pensionPaid + initialData.irpPaid;
  const pensionEligible = Math.min(initialData.pensionPaid, initialData.rule.pensionLimit);
  const totalEligible = Math.min(pensionEligible + initialData.irpPaid, initialData.rule.combinedLimit);
  const pensionRemaining = result?.pensionRemaining ?? initialData.rule.pensionLimit - pensionEligible;
  const totalRemaining = result?.totalRemaining ?? initialData.rule.combinedLimit - totalEligible;
  const excess = result
    ? result.pensionExcess + result.irpExcess
    : initialData.pensionPaid - pensionEligible + initialData.irpPaid - (totalEligible - pensionEligible);

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold text-emerald-700">2026년 연금계좌 세액공제</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">세금</h1>
        <p className="mt-2 text-sm text-slate-500">가계부 납입 내역을 바탕으로 남은 한도와 예상 절세 효과를 확인하세요.</p>
      </header>

      <TaxProfileForm action={saveProfileAction} data={initialData} />

      <section aria-label={`${initialData.taxYear}년 연금 납입 현황`} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">납입 요약</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">연금 납입 현황</h2>
          </div>
          <div className="flex gap-2">
            <Link className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50" href="/ledger?new=pension_savings">연금저축 추가</Link>
            <Link className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50" href="/ledger?new=irp">IRP 추가</Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-end justify-between gap-3"><p className="text-sm font-bold text-slate-600">연금저축 납입액</p><p className="text-xl font-black text-slate-950"><WonValue value={initialData.pensionPaid} /></p></div>
            <p className="mt-1 text-right text-xs text-slate-400">한도 <WonValue value={initialData.rule.pensionLimit} /></p>
            <div className="mt-4"><LimitProgress label="연금저축 공제 한도 진행률" max={initialData.rule.pensionLimit} value={initialData.pensionPaid} /></div>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-sm font-bold text-slate-600">IRP 납입액</p>
            <p className="mt-2 text-2xl font-black text-slate-950"><WonValue value={initialData.irpPaid} /></p>
            <p className="mt-2 text-xs leading-5 text-slate-400">연금저축 인정액과 합쳐 전체 공제 한도에 반영돼요.</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 md:col-span-2 xl:col-span-1">
            <div className="flex items-end justify-between gap-3"><p className="text-sm font-bold text-slate-600">전체 납입액</p><p className="text-xl font-black text-slate-950"><WonValue value={combinedPaid} /></p></div>
            <p className="mt-1 text-right text-xs text-slate-400">한도 <WonValue value={initialData.rule.combinedLimit} /></p>
            <div className="mt-4"><LimitProgress label="전체 공제 한도 진행률" max={initialData.rule.combinedLimit} value={pensionEligible + initialData.irpPaid} /></div>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-sm font-bold text-slate-600">연금저축 남은 한도</p><p className="mt-2 text-2xl font-black text-emerald-700"><WonValue value={pensionRemaining} /></p></article>
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-sm font-bold text-slate-600">전체 남은 한도</p><p className="mt-2 text-2xl font-black text-emerald-700"><WonValue value={totalRemaining} /></p></article>
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-sm font-bold text-slate-600">한도 초과 납입액</p><p className="mt-2 text-2xl font-black text-amber-700"><WonValue value={excess} /></p></article>
        </div>
      </section>

      {result ? (
        <section aria-label="예상 절세 결과" className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">입력 기준 계산</p><h2 className="mt-1 text-xl font-black">예상 절세 결과</h2></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl bg-white/8 p-4"><p className="text-sm font-bold text-slate-300">예상 적용 소득세 공제율</p><p className="mt-2 text-2xl font-black">{Math.round(result.incomeTaxRate * 100)}%</p></article>
            <article className="rounded-2xl bg-white/8 p-4"><p className="text-sm font-bold text-slate-300">소득세 세액공제 예상액</p><p className="mt-2 text-2xl font-black"><WonValue value={result.incomeTaxCredit} /></p></article>
            <article className="rounded-2xl bg-white/8 p-4"><p className="text-sm font-bold text-slate-300">지방소득세 감소 예상액</p><p className="mt-2 text-2xl font-black"><WonValue value={result.localIncomeTaxEffect} /></p></article>
            <article className="rounded-2xl bg-emerald-500 p-4"><p className="text-sm font-bold text-emerald-950">총 예상 절세액</p><p className="mt-2 text-2xl font-black text-white"><WonValue value={result.estimatedTotalBenefit} /></p></article>
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">총급여를 입력하면 예상 세액공제를 계산할 수 있어요.</p>
      )}

      <ContributionList editAction={editAction} error={pages.loadError} hasNext={pages.hasNext} items={pages.items} loading={pages.loading} onRetry={() => void pages.requestNextPage()} sentinelRef={pages.sentinelRef} />

      <aside className="rounded-3xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm sm:p-6">
        <p className="font-bold text-slate-900">예상치 및 공식 근거</p>
        <p className="mt-2">이 결과는 입력한 총급여와 PockeLog 납입 내역을 기준으로 계산한 예상치입니다. 실제 공제 및 환급액은 결정세액, 다른 공제 항목, 납입금의 적격 여부와 세법 변경 등에 따라 달라질 수 있습니다.</p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <a className="font-bold text-emerald-700 underline underline-offset-4" href={LAW_URL} rel="noreferrer" target="_blank">소득세법 제59조의3</a>
          <a className="font-bold text-emerald-700 underline underline-offset-4" href={NTS_URL} rel="noreferrer" target="_blank">국세청 연금계좌 세액공제 안내</a>
        </p>
        <p className="mt-3 text-xs text-slate-400">적용 규칙: {initialData.rule.ruleVersion}</p>
      </aside>
    </div>
  );
}

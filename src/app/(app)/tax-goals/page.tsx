import type { Metadata } from "next";

export const metadata: Metadata = { title: "세금 혜택" };

export default function TaxGoalsPage() {
  return (
    <div className="space-y-8">
      <header><p className="text-sm font-semibold text-emerald-700">절세 목표 관리</p><h1 className="mt-1 text-3xl font-black tracking-tight">세금</h1><p className="mt-2 text-sm text-slate-500">납입 현황을 기록하고 혜택 한도를 놓치지 않도록 준비하는 공간이에요.</p></header>
      <section className="grid gap-4 md:grid-cols-2">
        {[["연금저축 + IRP", "연간 납입 목표를 설정해 보세요"], ["추가 절세 항목", "나에게 맞는 항목을 직접 추가할 수 있게 준비 중이에요"]].map(([title, description]) => (
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm" key={title}>
            <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-0 rounded-full bg-emerald-500" /></div>
            <h2 className="mt-6 text-lg font-black">{title}</h2><p className="mt-2 text-sm text-slate-500">{description}</p>
            <button className="mt-5 text-sm font-bold text-emerald-700" type="button">목표 설정하기 →</button>
          </article>
        ))}
      </section>
      <p className="rounded-2xl bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">세금 화면의 정보는 관리 편의를 위한 참고용이며, 실제 공제 가능 여부와 한도는 관련 기관 또는 전문가를 통해 확인해야 해요.</p>
    </div>
  );
}

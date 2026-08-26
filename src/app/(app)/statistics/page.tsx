import type { Metadata } from "next";

export const metadata: Metadata = { title: "통계" };

export default function StatisticsPage() {
  return (
    <div className="space-y-8">
      <header><p className="text-sm font-semibold text-emerald-700">월별 흐름</p><h1 className="mt-1 text-3xl font-black tracking-tight">통계</h1></header>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="grid h-44 grid-cols-6 items-end gap-3 rounded-2xl bg-slate-50 p-6" aria-hidden="true">
          {[28, 48, 36, 72, 56, 86].map((height, index) => <div className="rounded-t-lg bg-emerald-200" key={index} style={{ height: `${height}%` }} />)}
        </div>
        <h2 className="mt-7 text-lg font-black">아직 표시할 통계가 없어요</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">수입과 지출 내역이 쌓이면 월별 금액과 분류별 사용 비중을 그래프로 보여드릴게요.</p>
      </section>
    </div>
  );
}

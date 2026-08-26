import type { Metadata } from "next";

export const metadata: Metadata = { title: "가계부" };

const summaries = [
  { label: "총 수입", value: "0원", color: "text-emerald-700" },
  { label: "총 지출", value: "0원", color: "text-rose-600" },
  { label: "남은 금액", value: "0원", color: "text-slate-900" },
];

export default function LedgerPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">이번 장부 기간</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">가계부</h1>
          <p className="mt-2 text-sm text-slate-500">기간을 선택해 수입과 지출 흐름을 확인하세요.</p>
        </div>
        <button className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700" type="button">+ 내역 추가</button>
      </section>

      <section aria-label="기간 요약" className="grid gap-4 sm:grid-cols-3">
        {summaries.map((item) => (
          <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm" key={item.label}>
            <p className="text-sm font-semibold text-slate-500">{item.label}</p>
            <p className={`mt-3 text-2xl font-black ${item.color}`}>{item.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white px-6 py-16 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">₩</div>
        <h2 className="mt-5 text-xl font-black text-slate-900">첫 내역을 기록해 보세요</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">수입이나 지출을 추가하면 이곳에서 날짜, 내용, 분류와 금액을 한눈에 확인할 수 있어요.</p>
        <button className="mt-6 rounded-2xl border border-emerald-200 px-5 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50" type="button">내역 추가하기</button>
      </section>
    </div>
  );
}

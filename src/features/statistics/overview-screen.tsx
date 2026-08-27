import Link from "next/link";

import type { StatisticsOverviewData } from "@/features/statistics/types";

const won = new Intl.NumberFormat("ko-KR");
const date = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function dateText(value: string) {
  return date.format(new Date(`${value}T00:00:00+09:00`));
}

function signedWon(value: number) {
  if (value === 0) return "0원";
  return `${value > 0 ? "+" : "-"}${won.format(Math.abs(value))}원`;
}

function comparison(income: number, expense: number) {
  const max = Math.max(income, expense);
  if (max === 0) return { income: 0, expense: 0 };
  return {
    income: Math.round((income / max) * 100),
    expense: Math.round((expense / max) * 100),
  };
}

export function StatisticsOverviewScreen({ data }: { data: StatisticsOverviewData }) {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-emerald-700">{data.ledger.name} · 월별 흐름</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">통계</h1>
        <p className="mt-2 text-sm text-slate-500">정산 기간별 수입과 지출을 비교하고 상세 내역을 확인하세요.</p>
      </header>

      <section aria-label="정산 기간별 통계" className="grid gap-4 xl:grid-cols-2">
        {data.periods.map((period) => {
          const bars = comparison(period.incomeTotal, period.expenseTotal);
          const empty = period.incomeTotal === 0 && period.expenseTotal === 0;
          return (
            <Link
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md sm:p-6"
              href={`/statistics/${period.key}`}
              key={period.key}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-900">{dateText(period.startOn)} ~ {dateText(period.endOn)}</p>
                  <p className={`mt-2 text-sm font-bold ${period.balance < 0 ? "text-rose-600" : "text-slate-600"}`}>
                    차액 {signedWon(period.balance)}
                  </p>
                </div>
                <span className="text-sm font-bold text-emerald-700 group-hover:translate-x-0.5">상세 →</span>
              </div>

              {empty ? (
                <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">기록 없음</div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div>
                    <div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-bold text-emerald-700">수입 {won.format(period.incomeTotal)}원</span><span className="text-slate-400">{bars.income}%</span></div>
                    <div aria-label="수입 비율" aria-valuemax={100} aria-valuemin={0} aria-valuenow={bars.income} className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${bars.income}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-bold text-rose-600">지출 {won.format(period.expenseTotal)}원</span><span className="text-slate-400">{bars.expense}%</span></div>
                    <div aria-label="지출 비율" aria-valuemax={100} aria-valuemin={0} aria-valuenow={bars.expense} className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar">
                      <div className="h-full rounded-full bg-rose-400" style={{ width: `${bars.expense}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </section>
    </div>
  );
}

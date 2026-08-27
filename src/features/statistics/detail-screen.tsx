"use client";

import Link from "next/link";

import type { StatisticsDetailData } from "@/features/statistics/types";
import { TransactionList } from "@/features/transactions/transaction-list";
import {
  useTransactionPages,
  type LoadTransactionPage,
} from "@/features/transactions/use-transaction-pages";

const won = new Intl.NumberFormat("ko-KR");
const ratio = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

type StatisticsDetailScreenProps = {
  initialData: StatisticsDetailData;
  loadPage?: LoadTransactionPage;
};

export function StatisticsDetailScreen(props: StatisticsDetailScreenProps) {
  const resetKey = `${props.initialData.period.key}:${props.initialData.type}`;
  return <StatisticsDetailContent {...props} key={resetKey} />;
}

function StatisticsDetailContent({
  initialData,
  loadPage,
}: StatisticsDetailScreenProps) {
  const pages = useTransactionPages(initialData.page, initialData.filters, loadPage);
  const typeLabel = initialData.type === "expense" ? "지출" : "수입";

  return (
    <div className="space-y-7">
      <header>
        <Link className="text-sm font-bold text-emerald-700" href="/statistics">← 월별 통계</Link>
        <p className="mt-5 text-sm font-semibold text-slate-500">{initialData.period.startOn} ~ {initialData.period.endOn}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">분류별 {typeLabel}</h1>
        <p className="mt-2 text-sm text-slate-500">총 {won.format(initialData.typeTotal)}원</p>
      </header>

      <nav aria-label="통계 유형" className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 sm:max-w-sm">
        {(["expense", "income"] as const).map((type) => {
          const label = type === "expense" ? "지출" : "수입";
          const active = initialData.type === type;
          return <Link aria-current={active ? "page" : undefined} className={`rounded-xl px-4 py-2.5 text-center text-sm font-bold ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`} href={`?type=${type}`} key={type}>{label}</Link>;
        })}
      </nav>

      <section aria-label={`분류별 ${typeLabel} 비율`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {initialData.categories.length === 0 ? (
          <div className="py-10 text-center"><p className="font-black text-slate-800">표시할 {typeLabel} 내역이 없어요</p><p className="mt-2 text-sm text-slate-500">가계부에서 내역을 추가하면 분류별 비율이 표시됩니다.</p></div>
        ) : (
          <div className="space-y-5">
            {initialData.categories.map((category) => (
              <article key={category.categoryId}>
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="min-w-0 flex-1 truncate font-black text-slate-900">{category.name}</span>
                  <span className="font-bold text-slate-600">{won.format(category.amountTotal)}원</span>
                  <span className="w-14 text-right text-slate-400">{ratio.format(category.ratio)}%</span>
                </div>
                <div aria-label={`${category.name} 비율`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(category.ratio)} className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar">
                  <div className="h-full rounded-full" style={{ backgroundColor: category.color, width: `${Math.min(category.ratio, 100)}%` }} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4"><h2 className="text-xl font-black text-slate-950">원본 거래</h2><p className="mt-1 text-sm text-slate-500">위 통계에 포함된 {typeLabel} 내역입니다.</p></div>
        {pages.items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-sm font-bold text-slate-400">해당 기간의 {typeLabel} 내역이 없습니다.</div>
        ) : (
          <TransactionList items={pages.items} hasNext={pages.hasNext} loading={pages.loading} error={pages.loadError} sentinelRef={pages.sentinelRef} onRetry={() => void pages.requestNextPage()} />
        )}
      </section>
    </div>
  );
}

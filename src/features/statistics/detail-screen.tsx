"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type {
  CategorySummary,
  StatisticsDetailData,
  StatisticsGroupSummary,
} from "@/features/statistics/types";
import { statisticsDetailPath } from "@/features/statistics/routing";
import { TransactionList } from "@/features/transactions/transaction-list";
import type { DailyBalance, TransactionFilters, TransactionPage } from "@/features/transactions/types";
import {
  fetchTransactionPage,
  SessionExpiredError,
  useTransactionPages,
  type LoadTransactionPage,
} from "@/features/transactions/use-transaction-pages";

const won = new Intl.NumberFormat("ko-KR");
const ratio = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

type StatisticsDetailScreenProps = {
  initialData: StatisticsDetailData;
  loadPage?: LoadTransactionPage;
};

function RatioBar({ color, name, value }: { color: string; name: string; value: number }) {
  return (
    <div aria-label={`${name} 비율`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(value)} className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar">
      <div className="h-full rounded-full" style={{ backgroundColor: color, width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function CategoryBreakdownRow({
  category,
  onSelect,
  selected,
}: {
  category: CategorySummary;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <article>
      <button aria-pressed={selected} className={`mb-2 flex w-full items-center gap-2 rounded-lg text-left text-sm ${selected ? "bg-emerald-50" : ""}`} onClick={onSelect} type="button">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
        <span className="min-w-0 flex-1 truncate font-black text-slate-900">{category.name}</span>
        <span className="font-bold text-slate-600">{won.format(category.amountTotal)}원</span>
        <span className="w-14 text-right text-slate-400">{ratio.format(category.ratio)}%</span>
      </button>
      <RatioBar color={category.color} name={category.name} value={category.ratio} />
    </article>
  );
}

function StatisticsGroupRow({
  expanded,
  group,
  onToggle,
  onSelect,
  selectedKey,
}: {
  expanded: boolean;
  group: StatisticsGroupSummary;
  onToggle: () => void;
  onSelect: (key: string, label: string, filter: { categoryId?: string; statisticsGroupId?: string }) => void;
  selectedKey: string | null;
}) {
  const detailsId = `statistics-group-${group.groupId}`;
  return (
    <article>
      <div className="mb-2 flex items-center gap-2">
        <button aria-controls={detailsId} aria-expanded={expanded} aria-label={`${group.name} 하위 분류 ${expanded ? "접기" : "펼치기"}`} className="flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-black text-slate-500" onClick={onToggle} type="button">{expanded ? "▾" : "▸"}</button>
        <button aria-pressed={selectedKey === `group:${group.groupId}`} className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left text-sm ${selectedKey === `group:${group.groupId}` ? "bg-emerald-50" : ""}`} onClick={() => onSelect(`group:${group.groupId}`, group.name, { statisticsGroupId: group.groupId })} type="button">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
          <span className="min-w-0 flex-1 truncate font-black text-slate-900">{group.name}</span>
          <span className="font-bold text-slate-600">{won.format(group.amountTotal)}원</span>
          <span className="w-14 text-right text-slate-400">{ratio.format(group.ratio)}%</span>
        </button>
      </div>
      <RatioBar color={group.color} name={group.name} value={group.ratio} />
      {expanded ? (
        <div className="ml-5 mt-4 space-y-4 border-l border-slate-200 pl-4" id={detailsId}>
          {group.categories.map((category) => (
            <CategoryBreakdownRow category={category} key={category.categoryId} onSelect={() => onSelect(`category:${category.categoryId}`, category.name, { categoryId: category.categoryId })} selected={selectedKey === `category:${category.categoryId}`} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function StatisticsDetailScreen(props: StatisticsDetailScreenProps) {
  const resetKey = `${props.initialData.period.key}:${props.initialData.type}`;
  return <StatisticsDetailContent {...props} key={resetKey} />;
}

function StatisticsDetailContent({
  initialData,
  loadPage,
}: StatisticsDetailScreenProps) {
  const router = useRouter();
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set());
  const [selection, setSelection] = useState<{ key: string; label: string; filters: TransactionFilters } | null>(null);
  const [selectedPage, setSelectedPage] = useState<TransactionPage | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState(false);
  const requestId = useRef(0);
  const typeLabel = initialData.type === "expense" ? "지출" : "수입";

  function clearSelection() {
    requestId.current += 1;
    setSelection(null);
    setSelectedPage(null);
    setFilterLoading(false);
    setFilterError(false);
  }

  async function loadSelection(nextSelection: { key: string; label: string; filters: TransactionFilters }) {
    const currentRequest = ++requestId.current;
    setSelection(nextSelection);
    setSelectedPage(null);
    setFilterLoading(true);
    setFilterError(false);
    try {
      const page = await (loadPage ?? fetchTransactionPage)(nextSelection.filters, "");
      if (requestId.current === currentRequest) setSelectedPage(page);
    } catch (error) {
      if (requestId.current === currentRequest) {
        if (error instanceof SessionExpiredError) {
          const next = statisticsDetailPath(initialData.period.key, initialData.type);
          router.push(`/login?next=${encodeURIComponent(next)}`);
        } else {
          setFilterError(true);
        }
      }
    } finally {
      if (requestId.current === currentRequest) setFilterLoading(false);
    }
  }

  function selectTransactions(key: string, label: string, filter: { categoryId?: string; statisticsGroupId?: string }) {
    if (selection?.key === key) {
      clearSelection();
      return;
    }
    const filters: TransactionFilters = { ...initialData.filters, ...filter };
    void loadSelection({ key, label, filters });
  }

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

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
        {initialData.breakdown.length === 0 ? (
          <div className="py-10 text-center"><p className="font-black text-slate-800">표시할 {typeLabel} 내역이 없어요</p><p className="mt-2 text-sm text-slate-500">가계부에서 내역을 추가하면 분류별 비율이 표시됩니다.</p></div>
        ) : (
          <div className="space-y-5">
            {initialData.breakdown.map((item) => (
              item.kind === "group" ? (
                <StatisticsGroupRow
                  expanded={expandedGroupIds.has(item.groupId)}
                  group={item}
                  key={item.groupId}
                  onToggle={() => toggleGroup(item.groupId)}
                  onSelect={selectTransactions}
                  selectedKey={selection?.key ?? null}
                />
              ) : (
                <CategoryBreakdownRow category={item.category} key={item.category.categoryId} onSelect={() => selectTransactions(`category:${item.category.categoryId}`, item.category.name, { categoryId: item.category.categoryId })} selected={selection?.key === `category:${item.category.categoryId}`} />
              )
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4"><h2 className="text-xl font-black text-slate-950">원본 거래</h2><p className="mt-1 text-sm text-slate-500">위 통계에 포함된 {typeLabel} 내역입니다.</p></div>
        {selection ? (
          <div className="mb-4 flex items-center gap-3 text-sm font-bold">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800">{selection.label}</span>
            <button className="text-slate-600 underline underline-offset-2" onClick={clearSelection} type="button">전체 보기</button>
          </div>
        ) : null}
        {filterLoading ? <p aria-live="polite" className="py-8 text-center text-sm text-slate-500">내역을 불러오는 중...</p> : null}
        {filterError ? <div className="py-8 text-center"><p role="alert" className="text-sm text-rose-600">내역을 불러오지 못했습니다.</p><button className="mt-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold" onClick={() => { if (selection) void loadSelection(selection); }} type="button">다시 시도</button></div> : null}
        {!filterLoading && !filterError ? (
          <StatisticsTransactionResults
            filters={selection?.filters ?? initialData.filters}
            key={selection?.key ?? "all"}
            loadPage={loadPage}
            page={selectedPage ?? initialData.page}
            dailyBalances={selection ? selectedPage?.dailyBalances : initialData.dailyBalances}
            typeLabel={typeLabel}
          />
        ) : null}
      </section>
    </div>
  );
}

function StatisticsTransactionResults({
  filters,
  loadPage,
  page,
  dailyBalances,
  typeLabel,
}: {
  filters: TransactionFilters;
  loadPage?: LoadTransactionPage;
  page: TransactionPage;
  dailyBalances?: DailyBalance[];
  typeLabel: string;
}) {
  const pages = useTransactionPages(page, filters, loadPage);
  return pages.items.length === 0 ? (
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-sm font-bold text-slate-400">해당 기간의 {typeLabel} 내역이 없습니다.</div>
  ) : (
    <TransactionList items={pages.items} dailyBalances={dailyBalances} hasNext={pages.hasNext} loading={pages.loading} error={pages.loadError} sentinelRef={pages.sentinelRef} onRetry={() => void pages.requestNextPage()} />
  );
}

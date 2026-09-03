"use client";

import { useState } from "react";

import { TransactionForm, type TransactionFormAction } from "@/features/transactions/transaction-form";
import { TransactionList } from "@/features/transactions/transaction-list";
import {
  useTransactionPages,
  type LoadTransactionPage,
} from "@/features/transactions/use-transaction-pages";
import type {
  LedgerPageData,
  TransactionActionState,
  TransactionListItem,
} from "@/features/transactions/types";

type UpdateAction = (id: string, state: TransactionActionState, formData: FormData) => Promise<TransactionActionState>;
type TrashAction = (id: string) => Promise<TransactionActionState>;
const won = new Intl.NumberFormat("ko-KR");

type LedgerScreenProps = {
  initialData: LedgerPageData;
  createAction: TransactionFormAction;
  updateAction: UpdateAction;
  trashAction: TrashAction;
  loadPage?: LoadTransactionPage;
};

export function LedgerScreen({ initialData, createAction, updateAction, trashAction, loadPage }: LedgerScreenProps) {
  const [selected, setSelected] = useState<TransactionListItem | null | undefined>(
    initialData.initialEditorItem ?? (initialData.initialCategoryId ? null : undefined),
  );
  const [summary, setSummary] = useState(initialData.summary);
  const pages = useTransactionPages(initialData.page, initialData.filters, loadPage);

  const moveSelectedToTrash = async (item: TransactionListItem) => {
    const result = await trashAction(item.id);
    if (result.status === "success") {
      pages.removeItem(item.id);
      setSummary((current) => item.type === "expense"
        ? {
            ...current,
            expenseTotal: current.expenseTotal - item.amount,
            balance: current.balance + item.amount,
          }
        : {
            ...current,
            incomeTotal: current.incomeTotal - item.amount,
            balance: current.balance - item.amount,
          });
    }
    return result;
  };

  const editAction: TransactionFormAction = selected
    ? (state, formData) => updateAction(selected.id, state, formData)
    : createAction;

  const summaryCards = [
    { label: "총 수입", value: summary.incomeTotal, color: "text-emerald-700", testId: "income-total" },
    { label: "총 지출", value: summary.expenseTotal, color: "text-rose-600", testId: "expense-total" },
    { label: "잔액", value: summary.balance, color: summary.balance < 0 ? "text-rose-600" : "text-slate-950", testId: "balance-total" },
  ];

  return (
    <div className="space-y-7">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">{initialData.filters.startOn} ~ {initialData.filters.endOn}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">가계부</h1>
          <p className="mt-2 text-sm text-slate-500">수입과 지출을 기록하고 기간별 흐름을 확인하세요.</p>
        </div>
        <button className="hidden rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 lg:block" onClick={() => setSelected(null)} type="button">+ 내역 추가</button>
      </section>

      <section aria-label="기간 요약" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <article className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm" key={card.label}>
            <p className="text-sm font-semibold text-slate-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-black ${card.color}`} data-testid={card.testId}>{won.format(card.value)}원</p>
          </article>
        ))}
      </section>

      <form action="/ledger" className="grid gap-3 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-7" method="get">
        <label className="min-w-0 text-xs font-bold text-slate-500 lg:col-span-1">시작일<input className="mt-1.5 w-full max-w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" defaultValue={initialData.filters.startOn} name="start" type="date" /></label>
        <label className="min-w-0 text-xs font-bold text-slate-500 lg:col-span-1">종료일<input className="mt-1.5 w-full max-w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" defaultValue={initialData.filters.endOn} name="end" type="date" /></label>
        <label className="min-w-0 text-xs font-bold text-slate-500 md:col-span-2 lg:col-span-2">검색<input className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" defaultValue={initialData.filters.query} maxLength={100} name="q" placeholder="내용 또는 메모" /></label>
        <label className="min-w-0 text-xs font-bold text-slate-500">유형<select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" defaultValue={initialData.filters.type} name="type"><option value="all">전체</option><option value="expense">지출</option><option value="income">수입</option></select></label>
        <label className="min-w-0 text-xs font-bold text-slate-500">분류<select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" defaultValue={initialData.filters.categoryId ?? ""} name="category"><option value="">전체</option>{initialData.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <div className="flex min-w-0 items-end gap-2"><select aria-label="정렬" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" defaultValue={initialData.filters.sort} name="sort"><option value="newest">최신순</option><option value="oldest">오래된순</option></select><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white" type="submit">조회</button></div>
      </form>

      {pages.items.length === 0 ? (
        <section className="rounded-3xl border border-slate-200/80 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">₩</div>
          <h2 className="mt-5 text-xl font-black text-slate-900">첫 내역을 기록해 보세요</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">수입이나 지출을 추가하면 날짜, 내용, 분류와 금액을 한눈에 확인할 수 있어요.</p>
          <button className="mt-6 rounded-2xl border border-emerald-200 px-5 py-3 text-sm font-bold text-emerald-700" onClick={() => setSelected(null)} type="button">내역 추가</button>
        </section>
      ) : (
        <TransactionList items={pages.items} hasNext={pages.hasNext} loading={pages.loading} error={pages.loadError} sentinelRef={pages.sentinelRef} onEdit={setSelected} onRetry={() => void pages.requestNextPage()} showCreator={initialData.ledger.kind === "shared"} />
      )}

      <button aria-label="내역 추가" className="fixed bottom-20 right-5 z-20 flex size-14 items-center justify-center rounded-full bg-emerald-600 text-3xl font-light text-white shadow-xl shadow-emerald-600/30 lg:hidden" onClick={() => setSelected(null)} type="button">+</button>

      {selected !== undefined ? (
        <TransactionForm
          action={editAction}
          categories={initialData.categories}
          initialCategoryId={initialData.initialCategoryId}
          item={selected}
          key={selected?.id ?? "new"}
          onClose={() => setSelected(undefined)}
          trashAction={selected ? () => moveSelectedToTrash(selected) : null}
        />
      ) : null}
    </div>
  );
}

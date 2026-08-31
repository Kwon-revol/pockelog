"use client";

import { useState, type RefObject } from "react";

import type { TaxContribution } from "@/features/tax/types";
import type { TaxActionState } from "@/features/tax/workflows";

const won = new Intl.NumberFormat("ko-KR");

export type TaxContributionEditAction = (
  transactionId: string,
) => Promise<TaxActionState>;

type ContributionListProps = {
  items: TaxContribution[];
  hasNext: boolean;
  loading: boolean;
  error: string | null;
  sentinelRef: RefObject<HTMLDivElement | null>;
  editAction?: TaxContributionEditAction;
  onRetry: () => void;
};

export function ContributionList({
  items,
  hasNext,
  loading,
  error,
  sentinelRef,
  editAction,
  onRetry,
}: ContributionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  async function handleEdit(transactionId: string) {
    if (!editAction || editingId) return;

    setEditingId(transactionId);
    setEditError(null);
    try {
      const result = await editAction(transactionId);
      if (result.status === "error") {
        setEditError(result.message ?? "납입 내역 편집 화면을 열지 못했습니다.");
      }
    } catch {
      setEditError("납입 내역 편집 화면을 열지 못했습니다.");
    } finally {
      setEditingId(null);
    }
  }

  return (
    <section aria-label="연금 납입 내역" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">가계부 자동 반영</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">납입 내역</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">내가 작성한 연금저축·IRP 지출만 모아 보여드려요.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-slate-50 px-5 py-10 text-center">
          <p className="font-black text-slate-800">아직 연금 납입 내역이 없어요</p>
          <p className="mt-2 text-sm text-slate-500">가계부에 연금저축 또는 IRP 지출을 추가해 보세요.</p>
        </div>
      ) : (
        <>
          <div aria-hidden="true" className="mt-6 hidden grid-cols-[120px_minmax(120px,0.8fr)_120px_minmax(160px,1fr)_120px] gap-4 border-b border-slate-100 px-4 pb-3 text-xs font-bold text-slate-400 lg:grid">
            <span>날짜</span><span>장부</span><span>분류</span><span>내용</span><span className="text-right">금액</span>
          </div>
          <ul className="mt-4 space-y-3 lg:mt-0 lg:space-y-0">
            {items.map((item) => (
              <li
                aria-label={`${item.description}, ${item.occurredOn}, ${item.canManage ? item.ledgerName : "이전 장부"}, ${item.categoryName}, ${won.format(item.amount)}원`}
                className="grid gap-3 rounded-2xl border border-slate-100 p-4 lg:grid-cols-[120px_minmax(120px,0.8fr)_120px_minmax(160px,1fr)_120px] lg:items-center lg:gap-4 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:border-t lg:px-4 lg:py-4"
                key={item.id}
              >
                <p className="text-sm text-slate-500"><span className="mr-2 font-bold text-slate-400 lg:hidden">날짜</span>{item.occurredOn}</p>
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="font-bold text-slate-400 lg:hidden">장부</span>
                  <span>{item.canManage ? item.ledgerName : "이전 장부"}</span>
                  {!item.canManage ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">읽기 전용</span> : null}
                </p>
                <p className="text-sm text-slate-600"><span className="mr-2 font-bold text-slate-400 lg:hidden">분류</span>{item.categoryName}</p>
                <div className="min-w-0">
                  {item.canManage && editAction ? (
                    <button aria-busy={editingId === item.id} className="max-w-full truncate rounded-lg text-left text-sm font-black text-slate-900 outline-none hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-wait disabled:opacity-60" disabled={editingId !== null} onClick={() => void handleEdit(item.id)} type="button">
                      <span className="sr-only">{item.description} 편집</span><span aria-hidden="true">{item.description}</span>
                    </button>
                  ) : <p className="truncate text-sm font-black text-slate-900">{item.description}</p>}
                </div>
                <p className="text-right text-base font-black text-emerald-700">{won.format(item.amount)}원</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {hasNext ? <div aria-hidden="true" className="h-2" ref={sentinelRef} /> : null}
      {loading ? <p aria-live="polite" className="py-4 text-center text-sm text-slate-500">납입 내역을 불러오는 중...</p> : null}
      {editError ? <p className="py-4 text-center text-sm font-semibold text-rose-600" role="alert">{editError}</p> : null}
      {error ? (
        <div className="py-4 text-center">
          <p className="text-sm font-semibold text-rose-600" role="alert">{error}</p>
          <button className="mt-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold" onClick={onRetry} type="button">다시 시도</button>
        </div>
      ) : null}
    </section>
  );
}

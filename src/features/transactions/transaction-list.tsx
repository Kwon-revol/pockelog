"use client";

import type { RefObject } from "react";

import type { TransactionListItem } from "@/features/transactions/types";

const won = new Intl.NumberFormat("ko-KR");

function amountText(item: TransactionListItem) {
  return `${item.type === "expense" ? "-" : "+"}${won.format(item.amount)}원`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${value}T00:00:00+09:00`));
}

type TransactionListProps = {
  items: TransactionListItem[];
  hasNext: boolean;
  loading: boolean;
  error: string | null;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onEdit?: (item: TransactionListItem) => void;
  showCreator?: boolean;
  onRetry: () => void;
};

export function TransactionList({
  items,
  hasNext,
  loading,
  error,
  sentinelRef,
  onEdit,
  showCreator = false,
  onRetry,
}: TransactionListProps) {
  if (items.length === 0) return null;

  const groups = items.reduce<Array<{ date: string; items: TransactionListItem[] }>>((result, item) => {
    const current = result.at(-1);
    if (current?.date === item.occurredOn) current.items.push(item);
    else result.push({ date: item.occurredOn, items: [item] });
    return result;
  }, []);

  return (
    <section aria-label="거래 내역" className="space-y-4">
      <div className="space-y-5 lg:hidden">
        {groups.map((group) => (
          <div key={group.date}>
            <h2 className="mb-2 text-sm font-bold text-slate-500">{dateLabel(group.date)}</h2>
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              {group.items.map((item) => {
                const content = <>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.category.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-slate-900">{item.description}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{item.category.name}{showCreator ? ` · ${item.createdBy.name} 작성` : ""}</span>
                  </span>
                  <span className={`font-black ${item.type === "expense" ? "text-rose-600" : "text-emerald-700"}`}>
                    {amountText(item)}
                  </span>
                </>;
                return onEdit && item.canManage ? (
                  <button className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-left last:border-0" key={item.id} onClick={() => onEdit(item)} type="button">{content}</button>
                ) : (
                  <div className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-left last:border-0" key={item.id}>{content}</div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:block">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-4">날짜</th>
              <th className="px-5 py-4">내용</th>
              <th className="px-5 py-4">분류</th>
              <th className="px-5 py-4">유형</th>
              {showCreator ? <th className="px-5 py-4">작성자</th> : null}
              <th className="px-5 py-4 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                className={`border-t border-slate-100 ${onEdit && item.canManage ? "cursor-pointer transition hover:bg-emerald-50/40" : ""}`}
                key={item.id}
                onClick={onEdit && item.canManage ? () => onEdit(item) : undefined}
              >
                <td className="px-5 py-4 text-slate-500">{item.occurredOn}</td>
                <td className="px-5 py-4 font-bold text-slate-900">{item.description}</td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ backgroundColor: item.category.color }} />{item.category.name}</span>
                </td>
                <td className="px-5 py-4 text-slate-500">{item.type === "expense" ? "지출" : "수입"}</td>
                {showCreator ? <td className="px-5 py-4 text-slate-500">{item.createdBy.name} 작성</td> : null}
                <td className={`px-5 py-4 text-right font-black ${item.type === "expense" ? "text-rose-600" : "text-emerald-700"}`}>{amountText(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasNext ? <div aria-hidden="true" className="h-2" data-testid="transaction-sentinel" ref={sentinelRef} /> : null}
      {loading ? <p aria-live="polite" className="py-3 text-center text-sm text-slate-500">내역을 불러오는 중...</p> : null}
      {error ? (
        <div className="py-3 text-center">
          <p role="alert" className="text-sm text-rose-600">{error}</p>
          <button className="mt-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold" onClick={onRetry} type="button">다시 시도</button>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  TRASH_LOGIN_PATH,
  type TrashActionState,
  type TrashItem,
  type TrashPage,
} from "@/features/trash/types";
import type { LoadTrashPage } from "@/features/trash/use-trash-pages";
import { useTrashPages } from "@/features/trash/use-trash-pages";

const won = new Intl.NumberFormat("ko-KR");
const date = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});
const dateTime = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Seoul",
});

export type TrashScreenProps = {
  ledgerName: string;
  initialPage: TrashPage;
  restoreAction: (id: string) => Promise<TrashActionState>;
  permanentlyDeleteAction: (id: string) => Promise<TrashActionState>;
  serverRevision: string;
  loadPage?: LoadTrashPage;
};

type TrashScreenContentProps = Omit<TrashScreenProps, "serverRevision">;

type ActionKind = "restore" | "permanentlyDelete";

function formatAmount(item: TrashItem) {
  return `${item.type === "expense" ? "-" : "+"}${won.format(item.amount)}원`;
}

function formatOccurredOn(value: string) {
  return date.format(new Date(`${value}T00:00:00+09:00`));
}

function formatDeletedAt(value: string) {
  return dateTime.format(new Date(value));
}

function ItemActions({
  error,
  item,
  onAction,
  pending,
}: {
  error?: string;
  item: TrashItem;
  onAction: (item: TrashItem, kind: ActionKind) => void;
  pending: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          aria-label={`${item.description} 복원`}
          className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-50"
          disabled={pending}
          onClick={() => onAction(item, "restore")}
          type="button"
        >
          복원
        </button>
        <button
          aria-label={`${item.description} 영구 삭제`}
          className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-50"
          disabled={pending}
          onClick={() => onAction(item, "permanentlyDelete")}
          type="button"
        >
          영구 삭제
        </button>
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-rose-600" role="alert">{error}</p> : null}
    </div>
  );
}

export function TrashAccessNotice() {
  return (
    <div className="rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-black text-slate-950">장부 소유자만 휴지통을 볼 수 있어요</h1>
      <p className="mt-2 text-sm text-slate-500">현재 장부의 휴지통을 열 권한이 없습니다.</p>
      <Link className="mt-5 inline-flex rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" href="/settings">설정으로 돌아가기</Link>
    </div>
  );
}

function TrashScreenContent({
  ledgerName,
  initialPage,
  restoreAction,
  permanentlyDeleteAction,
  loadPage,
}: TrashScreenContentProps) {
  const router = useRouter();
  const {
    accessRevoked,
    hasNext,
    items,
    loadError,
    loading,
    pendingIds,
    removeItem,
    requestNextPage,
    sentinelRef,
    setItemPending,
  } = useTrashPages(initialPage, loadPage);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const runAction = async (item: TrashItem, kind: ActionKind) => {
    if (pendingIds.has(item.id)) return;
    const restore = kind === "restore";
    const confirmation = restore
      ? "이 내역을 복원할까요?"
      : "이 내역은 복구할 수 없습니다. 영구 삭제할까요?";
    if (!window.confirm(confirmation)) return;

    setItemPending(item.id, true);
    setActionErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    try {
      const result = await (restore ? restoreAction(item.id) : permanentlyDeleteAction(item.id));
      if (result.status === "success") removeItem(item.id);
      else if (result.status === "unauthenticated") router.push(TRASH_LOGIN_PATH);
      else setActionErrors((current) => ({ ...current, [item.id]: result.message }));
    } catch {
      setActionErrors((current) => ({
        ...current,
        [item.id]: restore
          ? "복원하지 못했습니다. 다시 시도해 주세요."
          : "영구 삭제하지 못했습니다. 다시 시도해 주세요.",
      }));
    } finally {
      setItemPending(item.id, false);
    }
  };

  if (accessRevoked) return <TrashAccessNotice />;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold text-emerald-700">데이터 관리</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">{ledgerName} 휴지통</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">휴지통으로 이동한 내역을 복원하거나 영구 삭제할 수 있어요.</p>
      </header>

      {items.length === 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-black text-slate-950">휴지통이 비어 있어요</h2>
          <p className="mt-2 text-sm text-slate-500">삭제한 거래 내역이 없습니다.</p>
          <Link className="mt-5 inline-flex rounded-2xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50" href="/ledger">가계부로 돌아가기</Link>
        </section>
      ) : (
        <section aria-label="휴지통 내역" className="space-y-3 md:hidden">
          {items.map((item) => (
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-slate-950">{item.description}</p>
                  {item.memo ? <p className="mt-1 text-sm text-slate-500">{item.memo}</p> : null}
                </div>
                <p className={`shrink-0 font-black ${item.type === "expense" ? "text-rose-600" : "text-emerald-700"}`}>{formatAmount(item)}</p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className="text-xs text-slate-400">사용 날짜</dt><dd className="mt-0.5 font-semibold text-slate-700">{formatOccurredOn(item.occurredOn)}</dd></div>
                <div><dt className="text-xs text-slate-400">분류</dt><dd className="mt-0.5 flex items-center gap-2 font-semibold text-slate-700"><span className="size-2 rounded-full" style={{ backgroundColor: item.category.color }} /><span>{item.category.name}</span><span>{item.type === "expense" ? "지출" : "수입"}</span></dd></div>
                <div><dt className="text-xs text-slate-400">작성자</dt><dd className="mt-0.5 font-semibold text-slate-700">{item.createdBy.name}</dd></div>
                <div><dt className="text-xs text-slate-400">삭제 시각</dt><dd className="mt-0.5 font-semibold text-slate-700">{formatDeletedAt(item.deletedAt)}</dd></div>
              </dl>
              <div className="mt-4"><ItemActions error={actionErrors[item.id]} item={item} onAction={runAction} pending={pendingIds.has(item.id)} /></div>
            </article>
          ))}
        </section>
      )}

      {items.length > 0 ? (
        <table className="hidden w-full border-collapse overflow-hidden rounded-3xl border border-slate-200 bg-white text-sm shadow-sm md:table">
          <caption className="sr-only">휴지통 내역</caption>
          <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500">
            <tr><th className="px-4 py-4">사용 날짜</th><th className="px-4 py-4">내용</th><th className="px-4 py-4">분류</th><th className="px-4 py-4">유형</th><th className="px-4 py-4">작성자</th><th className="px-4 py-4">삭제 시각</th><th className="px-4 py-4 text-right">금액</th><th className="px-4 py-4">관리</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-t border-slate-100 align-top" key={item.id}>
                <td className="px-4 py-4 text-slate-500">{formatOccurredOn(item.occurredOn)}</td>
                <td className="px-4 py-4"><span className="font-bold text-slate-900">{item.description}</span>{item.memo ? <span className="mt-1 block text-xs text-slate-500">{item.memo}</span> : null}</td>
                <td className="px-4 py-4"><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ backgroundColor: item.category.color }} /><span>{item.category.name}</span></span></td>
                <td className="px-4 py-4 text-slate-500">{item.type === "expense" ? "지출" : "수입"}</td>
                <td className="px-4 py-4 text-slate-500">{item.createdBy.name}</td>
                <td className="px-4 py-4 text-slate-500">{formatDeletedAt(item.deletedAt)}</td>
                <td className={`px-4 py-4 text-right font-black ${item.type === "expense" ? "text-rose-600" : "text-emerald-700"}`}>{formatAmount(item)}</td>
                <td className="px-4 py-4"><ItemActions error={actionErrors[item.id]} item={item} onAction={runAction} pending={pendingIds.has(item.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {hasNext ? <div aria-hidden="true" className="h-2" data-testid="trash-sentinel" ref={sentinelRef} /> : null}
      {loading ? <p aria-live="polite" className="py-3 text-center text-sm text-slate-500">휴지통 내역을 불러오는 중...</p> : null}
      {loadError ? (
        <div className="py-3 text-center">
          <p className="text-sm font-semibold text-rose-600" role="alert">{loadError}</p>
          <button className="mt-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold" onClick={() => void requestNextPage()} type="button">다시 시도</button>
        </div>
      ) : null}
    </div>
  );
}

export function TrashScreen({ serverRevision, ...props }: TrashScreenProps) {
  return <TrashScreenContent key={serverRevision} {...props} />;
}

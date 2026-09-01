"use client";

import Link from "next/link";

import {
  CategoryManager,
  type CategoryActiveAction,
  type MoveCategoryAction,
  type UpdateCategoryAction,
} from "@/features/settings/category-manager";
import {
  LedgerSettingsForm,
  type SettingsFormAction,
} from "@/features/settings/ledger-settings-form";
import type { SettingsPageData } from "@/features/settings/types";
import {
  SharedLedgerManager,
  type SharedLedgerManagerActions,
} from "@/features/shared-ledgers/shared-ledger-manager";
import type { SharedLedgerPageData } from "@/features/shared-ledgers/types";

export function SettingsScreen({
  data,
  updateLedgerAction,
  createCategoryAction,
  updateCategoryAction,
  setCategoryActiveAction,
  moveCategoryAction,
  logoutAction,
  sharedLedgerData,
  sharedLedgerActions,
}: {
  data: SettingsPageData;
  updateLedgerAction: SettingsFormAction;
  createCategoryAction: SettingsFormAction;
  updateCategoryAction: UpdateCategoryAction;
  setCategoryActiveAction: CategoryActiveAction;
  moveCategoryAction: MoveCategoryAction;
  logoutAction: (formData: FormData) => Promise<void>;
  sharedLedgerData?: SharedLedgerPageData;
  sharedLedgerActions?: SharedLedgerManagerActions;
}) {
  return (
    <div className="space-y-7">
      <header><p className="text-sm font-semibold text-emerald-700">내 장부 관리</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">설정</h1><p className="mt-2 text-sm text-slate-500">정산 기간과 거래 분류를 내 사용 방식에 맞게 관리하세요.</p></header>
      {!data.isOwner ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">장부 소유자만 설정을 변경할 수 있어요. 현재 장부의 설정은 읽기 전용으로 표시됩니다.</p> : null}
      <LedgerSettingsForm action={updateLedgerAction} isOwner={data.isOwner} ledger={data.ledger} />
      <CategoryManager activeAction={setCategoryActiveAction} categories={data.categories} createAction={createCategoryAction} isOwner={data.isOwner} moveAction={moveCategoryAction} updateAction={updateCategoryAction} />
      {sharedLedgerData && sharedLedgerActions ? <SharedLedgerManager actions={sharedLedgerActions} data={sharedLedgerData} /> : null}
      {data.isOwner ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">장부 데이터</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">데이터 관리</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">삭제한 거래를 확인하고 복원하거나 영구 삭제할 수 있어요.</p>
          <Link className="mt-4 inline-flex rounded-2xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50" href="/settings/trash">휴지통 보기</Link>
        </section>
      ) : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-black text-slate-950">계정</h2><p className="mt-1 text-sm text-slate-500">이 기기에서 PockeLog 사용을 마칩니다.</p><form action={logoutAction} className="mt-4"><button className="rounded-2xl border border-rose-200 px-5 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50" type="submit">로그아웃</button></form></section>
    </div>
  );
}

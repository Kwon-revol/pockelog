import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutAction } from "@/features/auth/actions";
import {
  createCategoryAction,
  moveCategoryAction,
  setCategoryActiveAction,
  updateCategoryAction,
  updateLedgerSettingsAction,
} from "@/features/settings/actions";
import { getSettingsPageData, SettingsQueryError } from "@/features/settings/queries";
import { SettingsScreen } from "@/features/settings/settings-screen";

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  let data;
  try {
    data = await getSettingsPageData();
  } catch (error) {
    if (!(error instanceof SettingsQueryError)) throw error;
    return <div className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black text-slate-950">설정을 불러오지 못했어요</h1><p className="mt-2 text-sm text-slate-500">잠시 후 페이지를 새로고침해 주세요.</p></div>;
  }
  if (!data) redirect("/login?next=%2Fsettings");
  return <SettingsScreen createCategoryAction={createCategoryAction} data={data} logoutAction={logoutAction} moveCategoryAction={moveCategoryAction} setCategoryActiveAction={setCategoryActiveAction} updateCategoryAction={updateCategoryAction} updateLedgerAction={updateLedgerSettingsAction} />;
}

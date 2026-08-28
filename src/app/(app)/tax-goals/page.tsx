import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { saveTaxProfileAction } from "@/features/tax/actions";
import {
  getTaxPageData,
  TaxAuthenticationError,
  TaxQueryError,
} from "@/features/tax/queries";
import { TaxScreen } from "@/features/tax/tax-screen";

export const metadata: Metadata = { title: "세금 혜택" };

export default async function TaxGoalsPage() {
  let data;
  let authenticationFailed = false;
  try {
    data = await getTaxPageData(2026);
  } catch (error) {
    if (error instanceof TaxAuthenticationError) authenticationFailed = true;
    else if (error instanceof TaxQueryError) {
      return (
        <div className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black text-slate-950">세금 정보를 불러오지 못했어요</h1>
          <p className="mt-2 text-sm text-slate-500">잠시 후 페이지를 새로고침해 다시 시도해 주세요.</p>
        </div>
      );
    } else throw error;
  }

  if (authenticationFailed) redirect("/login?next=%2Ftax-goals");
  if (!data) throw new TaxQueryError();

  return <TaxScreen initialData={data} saveProfileAction={saveTaxProfileAction} />;
}

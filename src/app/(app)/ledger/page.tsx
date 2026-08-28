import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  createTransactionAction,
  trashTransactionAction,
  updateTransactionAction,
} from "@/features/transactions/actions";
import { LedgerScreen } from "@/features/transactions/ledger-screen";
import {
  getLedgerPageData,
  TransactionAuthenticationError,
} from "@/features/transactions/queries";

export const metadata: Metadata = { title: "가계부" };

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let data;
  try {
    data = await getLedgerPageData(await searchParams);
  } catch (error) {
    if (error instanceof TransactionAuthenticationError) redirect("/login?next=/ledger");
    throw error;
  }

  return (
    <LedgerScreen
      createAction={createTransactionAction}
      initialData={data}
      key={JSON.stringify([data.filters, data.summary, data.page.items, data.initialEditorItem?.id])}
      trashAction={trashTransactionAction}
      updateAction={updateTransactionAction}
    />
  );
}

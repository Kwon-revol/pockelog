import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAppContext } from "@/features/ledgers/queries";
import {
  permanentlyDeleteTransactionAction,
  restoreDeletedTransactionAction,
} from "@/features/trash/actions";
import {
  getTrashPageForCurrentUser,
  TrashAuthenticationError,
  TrashAuthorizationError,
  TrashQueryError,
  TrashUnavailableError,
} from "@/features/trash/queries";
import { TrashAccessNotice, TrashScreen } from "@/features/trash/trash-screen";
import { TRASH_LOGIN_PATH } from "@/features/trash/types";

export const metadata: Metadata = { title: "휴지통" };

function ErrorNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-black text-slate-950">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <Link className="mt-5 inline-flex rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" href="/settings">설정으로 돌아가기</Link>
    </div>
  );
}

export default async function TrashPage() {
  let initialPage;
  try {
    initialPage = await getTrashPageForCurrentUser();
  } catch (error) {
    if (error instanceof TrashAuthenticationError) {
      redirect(TRASH_LOGIN_PATH);
    }
    if (error instanceof TrashAuthorizationError) return <TrashAccessNotice />;
    if (error instanceof TrashUnavailableError) {
      return <ErrorNotice description="데이터베이스 준비가 완료된 뒤 다시 확인해 주세요." title="휴지통 준비가 아직 끝나지 않았어요" />;
    }
    if (error instanceof TrashQueryError) {
      return <ErrorNotice description="잠시 후 페이지를 새로고침해 다시 시도해 주세요." title="휴지통을 불러오지 못했어요" />;
    }
    throw error;
  }

  const context = await getCurrentAppContext();
  if (!context) redirect(TRASH_LOGIN_PATH);

  return (
    <TrashScreen
      initialPage={initialPage}
      ledgerName={context.currentLedger.name}
      permanentlyDeleteAction={permanentlyDeleteTransactionAction}
      restoreAction={restoreDeletedTransactionAction}
      serverRevision={crypto.randomUUID()}
    />
  );
}

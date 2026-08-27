"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { InvitationList } from "@/features/shared-ledgers/invitation-list";
import { MemberList } from "@/features/shared-ledgers/member-list";
import {
  initialSharedLedgerActionState,
  type SharedLedgerActionState,
  type SharedLedgerPageData,
} from "@/features/shared-ledgers/types";
import { SubmitButton } from "@/shared/ui/submit-button";

type FormAction = (state: SharedLedgerActionState, formData: FormData) => Promise<SharedLedgerActionState>;
type ImmediateAction = (...args: string[]) => Promise<SharedLedgerActionState>;

export type SharedLedgerManagerActions = {
  createAction: FormAction;
  inviteAction: FormAction;
  respondAction: (invitationId: string, response: "accept" | "decline") => Promise<SharedLedgerActionState>;
  revokeAction: ImmediateAction;
  removeAction: (ledgerId: string, userId: string) => Promise<SharedLedgerActionState>;
  leaveAction: ImmediateAction;
  deleteAction: FormAction;
};

function ActionMessage({ state }: { state: SharedLedgerActionState }) {
  return state.message ? <p className={`mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ${state.status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null;
}

export function SharedLedgerManager({ data, actions }: { data: SharedLedgerPageData; actions: SharedLedgerManagerActions }) {
  const router = useRouter();
  const [createState, createFormAction] = useActionState(actions.createAction, initialSharedLedgerActionState);
  const [inviteState, inviteFormAction] = useActionState(actions.inviteAction, initialSharedLedgerActionState);
  const [deleteState, deleteFormAction] = useActionState(actions.deleteAction, initialSharedLedgerActionState);
  const [result, setResult] = useState(initialSharedLedgerActionState);
  const [pending, startTransition] = useTransition();
  const shared = data.currentLedger.kind === "shared";
  const owner = shared && data.currentLedger.role === "owner";

  useEffect(() => {
    if (deleteState.status === "success") router.push("/ledger");
  }, [deleteState.status, router]);

  function run(action: () => Promise<SharedLedgerActionState>, navigateOnSuccess = false) {
    setResult(initialSharedLedgerActionState);
    startTransition(async () => {
      try {
        const next = await action();
        setResult(next);
        if (navigateOnSuccess && next.status === "success") router.push("/ledger");
      } catch {
        setResult({ status: "error", message: "공동 장부를 변경하지 못했습니다. 다시 시도해 주세요." });
      }
    });
  }

  return (
    <section aria-labelledby="shared-ledger-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">함께 쓰기</p><h2 className="mt-1 text-xl font-black text-slate-950" id="shared-ledger-title">공동 장부와 사용자</h2><p className="mt-2 text-sm leading-6 text-slate-500">가입한 사용자를 초대하고 장부를 함께 기록할 수 있어요.</p></div>

      <details className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4" open>
        <summary className="cursor-pointer text-sm font-black text-emerald-800">공동 장부 만들기</summary>
        <form action={createFormAction} className="mt-4 space-y-3">
          <label className="block text-sm font-bold text-slate-700">새 장부 이름<input className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" maxLength={50} name="name" required /></label>
          {createState.fieldErrors?.name?.[0] ? <p className="text-xs text-rose-600">{createState.fieldErrors.name[0]}</p> : null}
          <SubmitButton>공동 장부 만들기</SubmitButton>
          <ActionMessage state={createState} />
        </form>
      </details>

      <div className="mt-6"><h3 className="text-base font-black text-slate-900">받은 초대</h3><div className="mt-3"><InvitationList disabled={pending} invitations={data.receivedInvitations} mode="received" onRespond={(id, response) => run(() => actions.respondAction(id, response))} /></div></div>

      {shared ? <div className="mt-6 border-t border-slate-100 pt-6">
        <div className="flex items-center justify-between gap-3"><h3 className="text-base font-black text-slate-900">{data.currentLedger.name} 구성원</h3><span className="text-xs font-bold text-slate-500">{data.members.length}명</span></div>
        {owner ? <form action={inviteFormAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input name="ledgerId" type="hidden" value={data.currentLedger.id} />
          <label className="text-sm font-bold text-slate-700">초대할 아이디 또는 이메일<input aria-label="초대할 아이디 또는 이메일" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" name="identifier" required /></label>
          <div className="self-end sm:w-32"><SubmitButton>초대하기</SubmitButton></div>
          <div className="sm:col-span-2"><ActionMessage state={inviteState} /></div>
        </form> : null}
        <div className="mt-4"><MemberList canRemove={owner} disabled={pending} members={data.members} onRemove={(userId) => { if (window.confirm("이 구성원을 장부에서 제거할까요?")) run(() => actions.removeAction(data.currentLedger.id, userId)); }} /></div>
        {owner && data.sentInvitations.length ? <div className="mt-5"><h4 className="mb-3 text-sm font-black text-slate-700">보낸 초대</h4><InvitationList disabled={pending} invitations={data.sentInvitations} mode="sent" onRevoke={(id) => run(() => actions.revokeAction(id))} /></div> : null}
        {owner ? <details className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/40 p-4"><summary className="cursor-pointer text-sm font-black text-rose-700">공동 장부 삭제</summary><p className="mt-3 text-xs leading-5 text-rose-700">거래와 분류를 포함한 모든 데이터가 영구 삭제됩니다. 장부 이름을 정확히 입력해 주세요.</p><form action={deleteFormAction} className="mt-3 space-y-3"><input name="ledgerId" type="hidden" value={data.currentLedger.id} /><input aria-label="삭제 확인 장부 이름" className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3" name="confirmationName" required /><SubmitButton>공동 장부 삭제</SubmitButton><ActionMessage state={deleteState} /></form></details> : <button className="mt-6 rounded-2xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-50" disabled={pending} onClick={() => { if (window.confirm("이 공동 장부에서 나갈까요?")) run(() => actions.leaveAction(data.currentLedger.id), true); }} type="button">이 장부 나가기</button>}
      </div> : null}
      <ActionMessage state={result} />
    </section>
  );
}

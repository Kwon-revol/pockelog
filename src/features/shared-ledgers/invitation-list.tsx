import type { LedgerInvitation } from "@/features/shared-ledgers/types";

export function InvitationList({
  invitations,
  mode,
  disabled,
  onRespond,
  onRevoke,
}: {
  invitations: LedgerInvitation[];
  mode: "received" | "sent";
  disabled: boolean;
  onRespond?: (id: string, response: "accept" | "decline") => void;
  onRevoke?: (id: string) => void;
}) {
  if (!invitations.length) return <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">대기 중인 초대가 없습니다.</p>;

  return (
    <div className="space-y-2">
      {invitations.map((invitation) => (
        <article className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3" key={invitation.id}>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm text-slate-900">{mode === "received" ? invitation.ledgerName : invitation.targetName}</strong>
            <span className="text-xs text-slate-500">{mode === "received" ? `${invitation.invitedByName}님의 초대` : "수락 대기 중"}</span>
          </div>
          {invitation.status === "expired" ? <span className="text-xs font-bold text-slate-400">만료됨</span> : mode === "received" ? (
            <div className="flex gap-2">
              <button aria-label={`${invitation.ledgerName} 초대 수락`} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={disabled} onClick={() => onRespond?.(invitation.id, "accept")} type="button">수락</button>
              <button aria-label={`${invitation.ledgerName} 초대 거절`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50" disabled={disabled} onClick={() => onRespond?.(invitation.id, "decline")} type="button">거절</button>
            </div>
          ) : (
            <button aria-label={`${invitation.targetName} 초대 취소`} className="rounded-xl px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50" disabled={disabled} onClick={() => onRevoke?.(invitation.id)} type="button">초대 취소</button>
          )}
        </article>
      ))}
    </div>
  );
}

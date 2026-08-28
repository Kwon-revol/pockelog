import type { LedgerMember } from "@/features/shared-ledgers/types";

export function MemberList({
  members,
  canRemove,
  disabled,
  onRemove,
}: {
  members: LedgerMember[];
  canRemove: boolean;
  disabled: boolean;
  onRemove(userId: string): void;
}) {
  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3" key={member.userId}>
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800">{member.displayName.slice(0, 1)}</span>
          <strong className="min-w-0 flex-1 truncate text-sm text-slate-900">{member.displayName}</strong>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{member.role === "owner" ? "소유자" : "참여자"}</span>
          {canRemove && member.role === "member" ? <button aria-label={`${member.displayName} 제거`} className="text-xs font-bold text-rose-600 disabled:opacity-50" disabled={disabled} onClick={() => onRemove(member.userId)} type="button">제거</button> : null}
        </div>
      ))}
    </div>
  );
}

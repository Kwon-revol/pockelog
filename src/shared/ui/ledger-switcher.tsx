"use client";

import { useState, useTransition } from "react";

import type { AppLedger } from "@/features/ledgers/types";
import type { SharedLedgerActionState } from "@/features/shared-ledgers/types";

export type SwitchLedgerAction = (ledgerId: string) => Promise<SharedLedgerActionState>;

export function LedgerSwitcher({
  currentLedger,
  ledgers,
  action,
  compact = false,
}: {
  currentLedger: AppLedger;
  ledgers: AppLedger[];
  action: SwitchLedgerAction;
  compact?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className={compact ? "min-w-0" : "w-full"}>
      <label className="block text-xs font-semibold text-emerald-700">
        현재 장부
        <select
          aria-label="현재 장부"
          className={`mt-1 w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 font-bold text-slate-900 outline-none focus:border-emerald-500 ${compact ? "max-w-48 text-xs" : "text-sm"}`}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value;
            setMessage("");
            startTransition(async () => {
              try {
                const result = await action(next);
                if (result.status === "error") {
                  setMessage(result.message ?? "장부를 전환하지 못했습니다.");
                }
              } catch {
                setMessage("장부를 전환하지 못했습니다. 다시 시도해 주세요.");
              }
            });
          }}
          value={currentLedger.id}
        >
          {ledgers.map((ledger) => (
            <option key={ledger.id} value={ledger.id}>
              {ledger.kind === "personal" ? "개인 · " : "공동 · "}{ledger.name}
            </option>
          ))}
        </select>
      </label>
      {message ? <p className="mt-1 text-xs font-semibold text-rose-600" role="alert">{message}</p> : null}
    </div>
  );
}

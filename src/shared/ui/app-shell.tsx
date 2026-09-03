import Link from "next/link";

import type { AppLedger } from "@/features/ledgers/types";
import { AppNavigation } from "@/shared/ui/app-navigation";
import { LedgerSwitcher, type SwitchLedgerAction } from "@/shared/ui/ledger-switcher";

type AppShellProps = {
  children: React.ReactNode;
  currentLedger: AppLedger;
  ledgers: AppLedger[];
  pendingInvitationCount: number;
  switchLedgerAction: SwitchLedgerAction;
  userName: string;
};

export function AppShell({ children, currentLedger, ledgers, pendingInvitationCount, switchLedgerAction, userName }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f5f8f6]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200/80 bg-white px-5 py-7 lg:flex lg:flex-col">
        <Link className="px-3 text-2xl font-black tracking-[-0.05em] text-slate-950" href="/ledger">PockeLog</Link>
        <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-3">
          <LedgerSwitcher action={switchLedgerAction} currentLedger={currentLedger} ledgers={ledgers} />
        </div>
        {pendingInvitationCount ? <Link className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800" href="/settings">받은 초대 {pendingInvitationCount}개</Link> : null}
        <div className="mt-6 flex-1"><AppNavigation /></div>
        <Link className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50" href="/settings">
          {userName}님
        </Link>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="min-w-0 flex-1 lg:hidden">
              <p className="text-lg font-black tracking-[-0.04em]">PockeLog</p>
              <LedgerSwitcher action={switchLedgerAction} compact currentLedger={currentLedger} ledgers={ledgers} />
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-semibold text-slate-400">나의 재정 공간</p>
              <p className="font-bold text-slate-800">{currentLedger.name}</p>
            </div>
            <Link
              aria-label={pendingInvitationCount > 0 ? `설정 열기, 받은 초대 ${pendingInvitationCount}개` : "설정 열기"}
              className="relative flex size-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800"
              href="/settings"
            >
              {userName.slice(0, 1)}
              {pendingInvitationCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                  {pendingInvitationCount}
                </span>
              ) : null}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 pb-28 pt-8 md:px-8 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <AppNavigation mobile />
      </div>
    </div>
  );
}

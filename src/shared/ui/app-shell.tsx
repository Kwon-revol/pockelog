import Link from "next/link";

import type { AppLedger } from "@/features/ledgers/types";
import { LedgerSwitcher, type SwitchLedgerAction } from "@/shared/ui/ledger-switcher";

type AppShellProps = {
  children: React.ReactNode;
  currentLedger: AppLedger;
  ledgers: AppLedger[];
  pendingInvitationCount: number;
  switchLedgerAction: SwitchLedgerAction;
  userName: string;
};

const navigation = [
  { href: "/ledger", label: "가계부", icon: "book" },
  { href: "/statistics", label: "통계", icon: "chart" },
  { href: "/tax-goals", label: "세금", icon: "tax" },
  { href: "/settings", label: "설정", icon: "settings" },
] as const;

function NavIcon({ name }: { name: (typeof navigation)[number]["icon"] }) {
  const paths = {
    book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm0 0V22" />,
    chart: <path d="M4 20V10m6 10V4m6 16v-7m6 7H2" />,
    tax: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88L4.2 7.06l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3h4a1.7 1.7 0 0 0 1.03 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 21 10v4a1.7 1.7 0 0 0-1.6 1Z" /></>,
  };

  return (
    <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function Navigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav aria-label={mobile ? "모바일 주 메뉴" : "주 메뉴"} className={mobile ? "grid grid-cols-4" : "space-y-2"}>
      {navigation.map((item) => (
        <Link
          className={mobile
            ? "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-emerald-700"
            : "flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800"}
          href={item.href}
          key={item.href}
        >
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({ children, currentLedger, ledgers, pendingInvitationCount, switchLedgerAction, userName }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f5f8f6]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200/80 bg-white px-5 py-7 lg:flex lg:flex-col">
        <Link className="px-3 text-2xl font-black tracking-[-0.05em] text-slate-950" href="/ledger">PockeLog</Link>
        <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-3">
          <LedgerSwitcher action={switchLedgerAction} currentLedger={currentLedger} ledgers={ledgers} />
        </div>
        {pendingInvitationCount ? <Link className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800" href="/settings">받은 초대 {pendingInvitationCount}개</Link> : null}
        <div className="mt-6 flex-1"><Navigation /></div>
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
        <Navigation mobile />
      </div>
    </div>
  );
}

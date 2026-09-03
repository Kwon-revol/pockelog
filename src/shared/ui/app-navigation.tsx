"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label={mobile ? "모바일 주 메뉴" : "주 메뉴"} className={mobile ? "grid grid-cols-4" : "space-y-2"}>
      {navigation.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={mobile
              ? `mx-1 my-1 flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold transition ${active ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`
              : `flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${active ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"}`}
            href={item.href}
            key={item.href}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

import Link from "next/link";

import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/shared/config/product";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#e7fbf4_0,transparent_42%),linear-gradient(145deg,#f8faf9_0%,#eef4f1_100%)] px-5 py-12">
      <section className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/88 shadow-[0_24px_90px_rgba(24,78,63,0.12)] backdrop-blur">
        <div className="grid gap-10 px-7 py-10 sm:px-12 sm:py-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:px-16 lg:py-20">
          <div>
            <p className="mb-5 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              나와 우리를 위한 생활 기록
            </p>
            <h1 className="text-5xl font-black tracking-[-0.06em] text-slate-950 sm:text-6xl">
              {PRODUCT_NAME}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              {PRODUCT_DESCRIPTION}. 수입과 지출을 빠르게 기록하고, 원하는
              정산 기간으로 흐름을 한눈에 확인하세요.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-600 px-6 font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
              >
                무료로 시작하기
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 font-bold text-slate-700 transition hover:bg-slate-50"
              >
                로그인
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-slate-950 p-5 text-white shadow-2xl shadow-slate-900/20 sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">이번 정산 기간</p>
                <p className="mt-1 font-semibold">8월 생활 장부</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                개인 장부
              </span>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/7 p-4">
                <p className="text-xs text-slate-400">들어온 돈</p>
                <p className="mt-2 text-xl font-bold">2,800,000원</p>
              </div>
              <div className="rounded-2xl bg-white/7 p-4">
                <p className="text-xs text-slate-400">사용한 돈</p>
                <p className="mt-2 text-xl font-bold text-rose-300">846,500원</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-emerald-400 p-5 text-slate-950">
              <p className="text-sm font-medium opacity-70">남은 금액</p>
              <p className="mt-1 text-3xl font-black tracking-tight">1,953,500원</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

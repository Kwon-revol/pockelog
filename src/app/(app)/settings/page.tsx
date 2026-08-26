import type { Metadata } from "next";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header><p className="text-sm font-semibold text-emerald-700">내 장부 관리</p><h1 className="mt-1 text-3xl font-black tracking-tight">설정</h1></header>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {[["장부 기준일", "매월 1일 ~ 말일"], ["분류 관리", "수입·지출 분류 추가 및 숨기기"], ["장부 구성원", "현재 나만 사용 중"], ["계정 설정", "사용자명과 연락처 관리"]].map(([title, description]) => (
          <button className="flex w-full items-center justify-between border-b border-slate-100 px-6 py-5 text-left last:border-0 hover:bg-slate-50" key={title} type="button">
            <span><strong className="block text-sm text-slate-900">{title}</strong><span className="mt-1 block text-sm text-slate-500">{description}</span></span><span aria-hidden="true" className="text-slate-400">›</span>
          </button>
        ))}
      </section>
    </div>
  );
}

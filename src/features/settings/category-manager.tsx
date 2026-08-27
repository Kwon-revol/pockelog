"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";

import {
  initialSettingsActionState,
  type SettingsActionState,
  type SettingsCategory,
} from "@/features/settings/types";
import type { TransactionType } from "@/features/transactions/types";
import { SubmitButton } from "@/shared/ui/submit-button";
import type { SettingsFormAction } from "@/features/settings/ledger-settings-form";

const presets = ["#F97316", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#64748B"];

export type UpdateCategoryAction = (
  categoryId: string,
  state: SettingsActionState,
  formData: FormData,
) => Promise<SettingsActionState>;
export type CategoryActiveAction = (categoryId: string, active: boolean) => Promise<SettingsActionState>;
export type MoveCategoryAction = (
  categoryId: string,
  direction: "up" | "down",
  type: TransactionType,
  orderedIds: string[],
) => Promise<SettingsActionState>;

function CategoryForm({
  type,
  category,
  action,
  onClose,
}: {
  type: TransactionType;
  category: SettingsCategory | null;
  action: SettingsFormAction;
  onClose(): void;
}) {
  const [state, formAction] = useActionState(action, initialSettingsActionState);
  const [color, setColor] = useState(category?.color ?? presets[0]);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [onClose, state.status]);

  const typeLabel = type === "expense" ? "지출" : "수입";
  const title = category ? `${category.name} 분류 수정` : `${typeLabel} 분류 추가`;

  return (
    <div aria-label={title} aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-6" role="dialog">
      <div className="w-full rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold text-emerald-700">{typeLabel} 분류</p><h3 className="mt-1 text-xl font-black text-slate-950">{category ? "분류 수정" : "새 분류 추가"}</h3></div>
          <button aria-label="닫기" className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600" onClick={onClose} type="button">닫기</button>
        </div>
        <form action={formAction} className="space-y-5" noValidate>
          <input name="type" type="hidden" value={type} />
          <label className="block text-sm font-bold text-slate-700">분류 이름
            <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" defaultValue={category?.name ?? ""} maxLength={30} name="name" required />
            {state.fieldErrors?.name?.[0] ? <span className="mt-1 block text-xs text-rose-600">{state.fieldErrors.name[0]}</span> : null}
          </label>
          <fieldset>
            <legend className="text-sm font-bold text-slate-700">분류 색상</legend>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {presets.map((preset) => <button aria-label={`${preset} 색상 선택`} className={`size-9 rounded-full border-2 ${color === preset ? "border-slate-950" : "border-white ring-1 ring-slate-200"}`} key={preset} onClick={() => setColor(preset)} style={{ backgroundColor: preset }} type="button" />)}
              <input aria-label="직접 색상 선택" className="size-10 rounded-lg border-0 bg-transparent p-0" onChange={(event) => setColor(event.target.value.toUpperCase())} type="color" value={color} />
            </div>
            <input name="color" type="hidden" value={color} />
            {state.fieldErrors?.color?.[0] ? <span className="mt-1 block text-xs text-rose-600">{state.fieldErrors.color[0]}</span> : null}
          </fieldset>
          {state.message && state.status === "error" ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{state.message}</p> : null}
          <SubmitButton>{category ? "분류 저장" : "분류 추가"}</SubmitButton>
        </form>
      </div>
    </div>
  );
}

export function CategoryManager({
  categories,
  isOwner,
  createAction,
  updateAction,
  activeAction,
  moveAction,
}: {
  categories: SettingsCategory[];
  isOwner: boolean;
  createAction: SettingsFormAction;
  updateAction: UpdateCategoryAction;
  activeAction: CategoryActiveAction;
  moveAction: MoveCategoryAction;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [editor, setEditor] = useState<SettingsCategory | "new" | null>(null);
  const [result, setResult] = useState<SettingsActionState>(initialSettingsActionState);
  const [pending, startTransition] = useTransition();
  const typed = useMemo(() => categories.filter((category) => category.type === type), [categories, type]);
  const active = typed.filter((category) => category.isActive);
  const hidden = typed.filter((category) => !category.isActive);
  const orderedIds = [...active, ...hidden].map((category) => category.id);

  function run(action: () => Promise<SettingsActionState>) {
    startTransition(async () => {
      try {
        setResult(await action());
      } catch {
        setResult({
          status: "error",
          message: "분류를 변경하지 못했습니다. 다시 시도해 주세요.",
        });
      }
    });
  }

  return (
    <section aria-labelledby="category-settings-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">분류</p><h2 className="mt-1 text-xl font-black text-slate-950" id="category-settings-title">수입·지출 분류 관리</h2><p className="mt-2 text-sm leading-6 text-slate-500">숨긴 분류는 새 내역에서만 제외되고 기존 거래와 통계에는 남아 있습니다.</p></div>
        {isOwner ? <button className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700" onClick={() => setEditor("new")} type="button">분류 추가</button> : null}
      </div>
      <div aria-label="분류 유형" className="mt-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 sm:max-w-sm" role="group">
        {(["expense", "income"] as const).map((value) => <button aria-pressed={type === value} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${type === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`} key={value} onClick={() => { setType(value); setResult(initialSettingsActionState); }} type="button">{value === "expense" ? "지출 분류" : "수입 분류"}</button>)}
      </div>
      <div className="mt-5 space-y-3">
        {active.map((category, index) => (
          <article className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3" key={category.id}>
            <span className="size-3 rounded-full" style={{ backgroundColor: category.color }} />
            <strong className="min-w-0 flex-1 text-sm text-slate-900">{category.name}</strong>
            {isOwner ? <div className="flex items-center gap-1">
              <button aria-label={`${category.name} 위로 이동`} className="rounded-lg px-2 py-1 text-slate-500 disabled:opacity-30" disabled={pending || index === 0} onClick={() => run(() => moveAction(category.id, "up", type, orderedIds))} type="button">↑</button>
              <button aria-label={`${category.name} 아래로 이동`} className="rounded-lg px-2 py-1 text-slate-500 disabled:opacity-30" disabled={pending || index === active.length - 1} onClick={() => run(() => moveAction(category.id, "down", type, orderedIds))} type="button">↓</button>
              <button aria-label={`${category.name} 수정`} className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 disabled:opacity-30" disabled={pending} onClick={() => setEditor(category)} type="button">수정</button>
              <button aria-label={`${category.name} 숨기기`} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 disabled:opacity-30" disabled={pending} onClick={() => { if (window.confirm(`${category.name} 분류를 숨길까요?`)) run(() => activeAction(category.id, false)); }} type="button">숨기기</button>
            </div> : null}
          </article>
        ))}
        {active.length === 0 ? <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">표시 중인 {type === "expense" ? "지출" : "수입"} 분류가 없습니다.</p> : null}
      </div>
      {hidden.length ? <details className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4"><summary className="cursor-pointer text-sm font-bold text-slate-600">숨긴 분류 {hidden.length}개</summary><div className="mt-3 space-y-2">{hidden.map((category) => <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2" key={category.id}><span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} /><span className="flex-1 text-sm font-semibold text-slate-600">{category.name}</span>{isOwner ? <button aria-label={`${category.name} 다시 표시`} className="text-xs font-bold text-emerald-700" disabled={pending} onClick={() => run(() => activeAction(category.id, true))} type="button">다시 표시</button> : null}</div>)}</div></details> : null}
      {result.message ? <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${result.status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`} role={result.status === "error" ? "alert" : "status"}>{result.message}</p> : null}
      {editor ? <CategoryForm action={editor === "new" ? createAction : updateAction.bind(null, editor.id)} category={editor === "new" ? null : editor} onClose={() => setEditor(null)} type={type} /> : null}
    </section>
  );
}

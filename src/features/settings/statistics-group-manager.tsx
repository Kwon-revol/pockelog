"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";

import type { SettingsFormAction } from "@/features/settings/ledger-settings-form";
import {
  initialSettingsActionState,
  type SettingsActionState,
  type SettingsCategory,
  type SettingsStatisticsGroup,
} from "@/features/settings/types";
import type { TransactionType } from "@/features/transactions/types";
import { SubmitButton } from "@/shared/ui/submit-button";

const colorPresets = ["#F97316", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#64748B"];

export type StatisticsGroupManagerActions = {
  createAction: SettingsFormAction;
  updateAction: (
    groupId: string,
    state: SettingsActionState,
    formData: FormData,
  ) => Promise<SettingsActionState>;
  deleteAction: (groupId: string) => Promise<SettingsActionState>;
  moveAction: (
    groupId: string,
    direction: "up" | "down",
    type: TransactionType,
    orderedIds: string[],
  ) => Promise<SettingsActionState>;
};

function categoryNames(categories: SettingsCategory[]) {
  return categories
    .map((category) => `${category.name}${category.isActive ? "" : "(숨김)"}`)
    .join(", ");
}

function StatisticsGroupForm({
  type,
  group,
  categories,
  action,
  disabled,
  onClose,
  onPendingChange,
}: {
  type: TransactionType;
  group: SettingsStatisticsGroup | null;
  categories: SettingsCategory[];
  action: SettingsFormAction;
  disabled: boolean;
  onClose(): void;
  onPendingChange(pending: boolean): void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [selectedIds, setSelectedIds] = useState(() => new Set(group?.categoryIds ?? []));
  const [color, setColor] = useState(group?.color ?? colorPresets[0]);
  const [state, formAction, pending] = useActionState(
    async (previousState: SettingsActionState, formData: FormData) => {
      try {
        return await action(previousState, formData);
      } catch {
        return {
          status: "error" as const,
          message: "통계 그룹을 저장하지 못했습니다. 다시 시도해 주세요.",
        };
      }
    },
    initialSettingsActionState,
  );

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [onClose, state.status]);

  useEffect(() => {
    onPendingChange(pending);
  }, [onPendingChange, pending]);

  useEffect(() => () => onPendingChange(false), [onPendingChange]);

  const formDisabled = disabled || pending;

  const movesExistingCategory = categories.some((category) => (
    selectedIds.has(category.id)
    && category.statisticsGroupId !== null
    && category.statisticsGroupId !== group?.id
  ));
  const typeLabel = type === "expense" ? "지출" : "수입";

  function toggleCategory(categoryId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(categoryId);
      else next.delete(categoryId);
      return next;
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-emerald-700">{typeLabel} 그룹</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">{group ? `${group.name} 수정` : "새 통계 그룹"}</h3>
        </div>
        <button className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white disabled:opacity-50" disabled={formDisabled} onClick={onClose} type="button">편집 취소</button>
      </div>
      <form action={formAction} className="mt-5" noValidate>
        <fieldset className="space-y-5 disabled:opacity-60" disabled={formDisabled}>
          <input name="type" type="hidden" value={type} />
        <label className="block text-sm font-bold text-slate-700">
          그룹 이름
          <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500" maxLength={30} name="name" onChange={(event) => setName(event.target.value)} required value={name} />
          {state.fieldErrors?.name?.[0] ? <span className="mt-1 block text-xs text-rose-600">{state.fieldErrors.name[0]}</span> : null}
        </label>
        <fieldset>
          <legend className="text-sm font-bold text-slate-700">그룹 색상</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {colorPresets.map((preset) => (
              <button
                aria-label={`${preset} 색상 선택`}
                aria-pressed={color === preset}
                className={`size-9 rounded-full border-2 ${color === preset ? "border-slate-950" : "border-white ring-1 ring-slate-200"}`}
                key={preset}
                onClick={() => setColor(preset)}
                style={{ backgroundColor: preset }}
                type="button"
              />
            ))}
          </div>
          <input name="color" type="hidden" value={color} />
          {state.fieldErrors?.color?.[0] ? <span className="mt-1 block text-xs text-rose-600">{state.fieldErrors.color[0]}</span> : null}
        </fieldset>
        <fieldset>
          <legend className="text-sm font-bold text-slate-700">포함할 상세 분류</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700" key={category.id}>
                <input
                  aria-label={category.name}
                  checked={selectedIds.has(category.id)}
                  className="size-4 accent-emerald-600"
                  name="categoryIds"
                  onChange={(event) => toggleCategory(category.id, event.target.checked)}
                  type="checkbox"
                  value={category.id}
                />
                <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                <span className="min-w-0 flex-1">{category.name}</span>
                {!category.isActive ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">숨김</span> : null}
              </label>
            ))}
          </div>
          {categories.length === 0 ? <p className="mt-2 rounded-2xl bg-white px-4 py-5 text-center text-sm text-slate-500">선택할 상세 분류가 없습니다.</p> : null}
          {state.fieldErrors?.categoryIds?.[0] ? <span className="mt-1 block text-xs text-rose-600">{state.fieldErrors.categoryIds[0]}</span> : null}
        </fieldset>
        {movesExistingCategory ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">저장하면 기존 그룹에서 이 그룹으로 이동해요.</p> : null}
        {state.message && state.status === "error" ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{state.message}</p> : null}
          <SubmitButton>그룹 저장</SubmitButton>
        </fieldset>
      </form>
    </div>
  );
}

export function StatisticsGroupManager({
  groups,
  categories,
  isOwner,
  available,
  actions,
}: {
  groups: SettingsStatisticsGroup[];
  categories: SettingsCategory[];
  isOwner: boolean;
  available: boolean;
  actions: StatisticsGroupManagerActions;
}) {
  const [type, setType] = useState<TransactionType>("expense");
  const [editor, setEditor] = useState<SettingsStatisticsGroup | "new" | null>(null);
  const [result, setResult] = useState<SettingsActionState>(initialSettingsActionState);
  const [formPending, setFormPending] = useState(false);
  const [mutationPending, startTransition] = useTransition();
  const busy = formPending || mutationPending;
  const typedGroups = useMemo(
    () => groups
      .filter((group) => group.type === type)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)),
    [groups, type],
  );
  const typedCategories = useMemo(
    () => categories
      .filter((category) => category.type === type)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)),
    [categories, type],
  );
  const unassigned = typedCategories.filter((category) => category.statisticsGroupId === null);
  const orderedIds = typedGroups.map((group) => group.id);

  function run(action: () => Promise<SettingsActionState>) {
    startTransition(async () => {
      try {
        setResult(await action());
      } catch {
        setResult({
          status: "error",
          message: "통계 그룹을 변경하지 못했습니다. 다시 시도해 주세요.",
        });
      }
    });
  }

  if (!available) {
    return (
      <section aria-label="통계 그룹 관리" className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-6 shadow-sm sm:px-6">
        <p className="text-sm font-semibold text-amber-800">Supabase 통계 그룹 설정을 먼저 적용해 주세요.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="statistics-group-settings-title" aria-label="통계 그룹 관리" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">통계</p>
          <h2 className="mt-1 text-xl font-black text-slate-950" id="statistics-group-settings-title">통계 그룹 관리</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">상세 분류를 묶어 통계에서 함께 보고, 거래 입력에서는 기존 상세 분류를 그대로 사용합니다.</p>
        </div>
        {isOwner ? <button className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700" disabled={busy} onClick={() => setEditor("new")} type="button">통계 그룹 추가</button> : null}
      </div>
      <div aria-label="통계 그룹 유형" className="mt-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 sm:max-w-sm" role="group">
        {(["expense", "income"] as const).map((value) => (
          <button
            aria-pressed={type === value}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold ${type === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
            disabled={busy}
            key={value}
            onClick={() => {
              setType(value);
              setEditor(null);
              setResult(initialSettingsActionState);
            }}
            type="button"
          >
            {value === "expense" ? "지출 그룹" : "수입 그룹"}
          </button>
        ))}
      </div>
      {editor && isOwner ? (
        <StatisticsGroupForm
          action={editor === "new" ? actions.createAction : actions.updateAction.bind(null, editor.id)}
          categories={typedCategories}
          disabled={mutationPending}
          group={editor === "new" ? null : editor}
          key={editor === "new" ? `new-${type}` : editor.id}
          onClose={() => setEditor(null)}
          onPendingChange={setFormPending}
          type={type}
        />
      ) : null}
      <div className="mt-5 space-y-3">
        {typedGroups.map((group, index) => {
          const included = typedCategories.filter((category) => category.statisticsGroupId === group.id);
          return (
            <article className="rounded-2xl border border-slate-200 px-4 py-4" key={group.id}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="size-3 rounded-full" style={{ backgroundColor: group.color }} />
                <strong className="min-w-0 flex-1 text-sm text-slate-900">{group.name}</strong>
                <span className="text-xs font-semibold text-slate-400">{index + 1}번째</span>
                {isOwner ? (
                  <div className="flex items-center gap-1">
                    <button aria-label={`${group.name} 위로 이동`} className="rounded-lg px-2 py-1 text-slate-500 disabled:opacity-30" disabled={busy || index === 0} onClick={() => run(() => actions.moveAction(group.id, "up", type, orderedIds))} type="button">↑</button>
                    <button aria-label={`${group.name} 아래로 이동`} className="rounded-lg px-2 py-1 text-slate-500 disabled:opacity-30" disabled={busy || index === typedGroups.length - 1} onClick={() => run(() => actions.moveAction(group.id, "down", type, orderedIds))} type="button">↓</button>
                    <button aria-label={`${group.name} 수정`} className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 disabled:opacity-30" disabled={busy} onClick={() => setEditor(group)} type="button">수정</button>
                    <button
                      aria-label={`${group.name} 삭제`}
                      className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 disabled:opacity-30"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`${group.name} 그룹을 삭제할까요? 상세 분류와 거래는 유지됩니다.`)) {
                          run(() => actions.deleteAction(group.id));
                        }
                      }}
                      type="button"
                    >삭제</button>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{included.length > 0 ? categoryNames(included) : "포함된 상세 분류가 없습니다."}</p>
            </article>
          );
        })}
        {typedGroups.length === 0 ? <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">등록된 {type === "expense" ? "지출" : "수입"} 그룹이 없습니다.</p> : null}
      </div>
      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
        <p className="text-sm font-bold text-slate-700">그룹 미지정: {unassigned.length > 0 ? categoryNames(unassigned) : "없음"}</p>
      </div>
      {result.message ? <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${result.status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`} role={result.status === "error" ? "alert" : "status"}>{result.message}</p> : null}
    </section>
  );
}

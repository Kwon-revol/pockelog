"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import type {
  CategoryOption,
  TransactionActionState,
  TransactionListItem,
  TransactionType,
} from "@/features/transactions/types";
import { initialTransactionActionState } from "@/features/transactions/types";
import { SubmitButton } from "@/shared/ui/submit-button";

export type TransactionFormAction = (
  state: TransactionActionState,
  formData: FormData,
) => Promise<TransactionActionState>;

type TransactionFormProps = {
  categories: CategoryOption[];
  item: TransactionListItem | null;
  action: TransactionFormAction;
  trashAction: (() => Promise<TransactionActionState>) | null;
  onClose: () => void;
};

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.[0] ? <p className="mt-1 text-xs font-medium text-rose-600">{errors[0]}</p> : null;
}

export function TransactionForm({ categories, item, action, trashAction, onClose }: TransactionFormProps) {
  const [state, formAction] = useActionState(action, initialTransactionActionState);
  const [type, setType] = useState<TransactionType>(item?.type ?? "expense");
  const [categoryId, setCategoryId] = useState(item?.category.id ?? "");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [trashPending, startTrash] = useTransition();
  const mode = item ? "수정" : "추가";

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [onClose, state.status]);

  const availableCategories = categories.filter((category) => category.type === type);
  const changeType = (next: TransactionType) => {
    setType(next);
    setCategoryId("");
  };

  const moveToTrash = () => {
    if (!trashAction || !window.confirm("이 내역을 휴지통으로 이동할까요?")) return;
    startTrash(() => {
      void trashAction().then((result) => {
        if (result.status === "success") onClose();
      });
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/30 lg:items-stretch lg:justify-end" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-label={`내역 ${mode}`} aria-modal="true" className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl lg:max-h-none lg:w-[30rem] lg:rounded-none lg:p-8" role="dialog">
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-bold text-emerald-700">{item ? "기록 수정" : "새 기록"}</p><h2 className="mt-1 text-2xl font-black">내역 {mode}</h2></div>
          <button aria-label="닫기" className="size-10 rounded-full bg-slate-100 text-xl" onClick={onClose} type="button">×</button>
        </div>

        <form action={formAction} className="mt-7 space-y-5" noValidate>
          <input name="idempotencyKey" type="hidden" value={item ? "" : idempotencyKey} />
          <fieldset>
            <legend className="text-sm font-bold text-slate-700">유형</legend>
            <div className="mt-2 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
              {(["expense", "income"] as const).map((value) => (
                <label className={`cursor-pointer rounded-xl px-4 py-2.5 text-center text-sm font-bold ${type === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`} key={value}>
                  <input checked={type === value} className="sr-only" name="type" onChange={() => changeType(value)} type="radio" value={value} />
                  {value === "expense" ? "지출" : "수입"}
                </label>
              ))}
            </div>
            <FieldError errors={state.fieldErrors?.type} />
          </fieldset>

          <label className="block text-sm font-bold text-slate-700">사용 날짜
            <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" defaultValue={item?.occurredOn ?? todayInSeoul()} name="occurredOn" required type="date" />
            <FieldError errors={state.fieldErrors?.occurredOn} />
          </label>
          <label className="block text-sm font-bold text-slate-700">내용
            <input className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" defaultValue={item?.description} maxLength={100} name="description" placeholder="예: 점심 식사" required />
            <FieldError errors={state.fieldErrors?.description} />
          </label>
          <label className="block text-sm font-bold text-slate-700">분류
            <select className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500" name="categoryId" onChange={(event) => setCategoryId(event.target.value)} required value={categoryId}>
              <option value="">분류 선택</option>
              {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <FieldError errors={state.fieldErrors?.categoryId} />
          </label>
          <label className="block text-sm font-bold text-slate-700">금액
            <div className="relative mt-2"><input className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-10 text-right text-lg font-black outline-none focus:border-emerald-500" defaultValue={item?.amount} inputMode="numeric" name="amount" pattern="[0-9,]*" placeholder="0" required /><span className="absolute right-4 top-3.5 text-sm font-bold text-slate-400">원</span></div>
            <FieldError errors={state.fieldErrors?.amount} />
          </label>
          <label className="block text-sm font-bold text-slate-700">메모 <span className="font-normal text-slate-400">(선택)</span>
            <textarea className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" defaultValue={item?.memo} maxLength={500} name="memo" placeholder="기억할 내용을 적어두세요." />
            <FieldError errors={state.fieldErrors?.memo} />
          </label>

          {state.message && state.status === "error" ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{state.message}</p> : null}

          <div className="flex gap-3 pt-2">
            {item ? <button className="rounded-2xl border border-rose-200 px-5 py-3 text-sm font-bold text-rose-600 disabled:opacity-50" disabled={trashPending} onClick={moveToTrash} type="button">삭제</button> : null}
            <div className="flex-1"><SubmitButton>{item ? "수정 저장" : "저장"}</SubmitButton></div>
          </div>
        </form>
      </section>
    </div>
  );
}

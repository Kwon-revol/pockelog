import { z } from "zod";

import { addDays, isValidDateString } from "@/features/transactions/period";
import type { TransactionFilters } from "@/features/transactions/types";

const dateSchema = z.string().refine(isValidDateString, "올바른 날짜를 입력해 주세요.");
const amountSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*$/, "금액은 1원 이상의 숫자로 입력해 주세요.")
  .refine((value) => BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER), "금액이 너무 큽니다.")
  .transform(Number);

export const transactionFormSchema = z.object({
  type: z.enum(["income", "expense"], { message: "수입 또는 지출을 선택해 주세요." }),
  occurredOn: dateSchema,
  description: z.string().trim().min(1, "내용을 입력해 주세요.").max(100, "내용은 100자 이하로 입력해 주세요."),
  amount: amountSchema,
  categoryId: z.uuid("분류를 선택해 주세요."),
  memo: z.string().trim().max(500, "메모는 500자 이하로 입력해 주세요."),
  idempotencyKey: z.uuid().optional(),
});

export const transactionIdSchema = z.uuid();
export type TransactionFormInput = z.infer<typeof transactionFormSchema>;

type QueryInput = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeTransactionFilters(
  input: QueryInput,
  defaults: Pick<TransactionFilters, "startOn" | "endOn" | "endExclusive">,
): TransactionFilters {
  const rawStart = first(input.start);
  const rawEnd = first(input.end);
  const hasValidRange = Boolean(
    rawStart && rawEnd && isValidDateString(rawStart) && isValidDateString(rawEnd) && rawStart <= rawEnd,
  );
  const startOn = hasValidRange ? rawStart! : defaults.startOn;
  const endOn = hasValidRange ? rawEnd! : defaults.endOn;
  const rawType = first(input.type);
  const rawCategory = first(input.category);
  const rawSort = first(input.sort);

  return {
    startOn,
    endOn,
    endExclusive: hasValidRange ? addDays(endOn, 1) : defaults.endExclusive,
    query: (first(input.q) ?? "").trim().slice(0, 100),
    type: rawType === "income" || rawType === "expense" ? rawType : "all",
    categoryId: z.uuid().safeParse(rawCategory).success ? rawCategory! : null,
    sort: rawSort === "oldest" ? "oldest" : "newest",
  };
}

export function formDataToTransactionInput(formData: FormData) {
  const value = (key: string) => {
    const entry = formData.get(key);
    return typeof entry === "string" ? entry : "";
  };
  return transactionFormSchema.safeParse({
    type: value("type"),
    occurredOn: value("occurredOn"),
    description: value("description"),
    amount: value("amount").replaceAll(",", ""),
    categoryId: value("categoryId"),
    memo: value("memo"),
    idempotencyKey: value("idempotencyKey") || undefined,
  });
}

import { decodeCursor } from "@/features/transactions/cursor";
import { addDays, isValidDateString } from "@/features/transactions/period";
import { normalizeTransactionFilters } from "@/features/transactions/schemas";

const invalid = { ok: false as const, message: "잘못된 조회 요청입니다." };

export function parseTransactionPageParams(params: URLSearchParams) {
  const cursor = params.get("cursor") ?? "";
  const startOn = params.get("start") ?? "";
  const endOn = params.get("end") ?? "";
  if (
    !decodeCursor(cursor)
    || !isValidDateString(startOn)
    || !isValidDateString(endOn)
    || startOn > endOn
  ) {
    return invalid;
  }

  const input = Object.fromEntries(params.entries());
  return {
    ok: true as const,
    cursor,
    filters: normalizeTransactionFilters(input, {
      startOn,
      endOn,
      endExclusive: addDays(endOn, 1),
    }),
  };
}

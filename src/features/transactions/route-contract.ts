import { decodeCursor } from "@/features/transactions/cursor";
import { addDays, isValidDateString } from "@/features/transactions/period";
import { normalizeTransactionFilters } from "@/features/transactions/schemas";
import { z } from "zod";

const invalid = { ok: false as const, message: "잘못된 조회 요청입니다." };

export function parseTransactionPageParams(params: URLSearchParams) {
  const cursor = params.get("cursor") ?? "";
  const startOn = params.get("start") ?? "";
  const endOn = params.get("end") ?? "";
  if (
    (cursor !== "" && !decodeCursor(cursor))
    || !isValidDateString(startOn)
    || !isValidDateString(endOn)
    || startOn > endOn
  ) {
    return invalid;
  }

  const categoryIds = params.getAll("categories");
  if (categoryIds.length > 100 || categoryIds.some((id) => !z.uuid().safeParse(id).success)) {
    return invalid;
  }

  const input = Object.fromEntries(params.entries());
  return {
    ok: true as const,
    cursor,
    filters: {
      ...normalizeTransactionFilters(input, {
        startOn,
        endOn,
        endExclusive: addDays(endOn, 1),
      }),
      ...(categoryIds.length ? { categoryIds: [...new Set(categoryIds)] } : {}),
    },
  };
}

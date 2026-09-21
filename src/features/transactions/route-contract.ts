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
  const groupId = params.get("group");
  if (
    categoryIds.length > 100
    || categoryIds.some((id) => !z.uuid().safeParse(id).success)
    || params.getAll("category").length > 1
    || params.getAll("group").length > 1
    || (groupId !== null && !z.uuid().safeParse(groupId).success)
    || Number(Boolean(params.get("category"))) + Number(categoryIds.length > 0) + Number(groupId !== null) > 1
  ) {
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
      ...(groupId ? { statisticsGroupId: groupId } : {}),
    },
  };
}

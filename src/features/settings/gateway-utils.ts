import type { SettingsChangeResult } from "@/features/settings/workflows";

type CategoryUpdateResult = SettingsChangeResult | "duplicate";
type ErrorLike = { code?: string } | null;

export function resolveNextCategorySortOrder(
  last: { sort_order: number } | null,
  error: ErrorLike,
): number | null {
  if (error) return null;
  return (last?.sort_order ?? -1) + 1;
}

export function mapCategoryUpdateResult(
  errorCode: string | undefined | null,
  hasData: boolean,
): CategoryUpdateResult {
  if (!errorCode && hasData) return "updated";
  if (errorCode === "23505") return "duplicate";
  if (errorCode === "42501" || (!errorCode && !hasData)) return "forbidden";
  return "error";
}

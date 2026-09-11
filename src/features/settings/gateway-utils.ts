import type {
  SettingsChangeResult,
  StatisticsGroupSaveResult,
} from "@/features/settings/workflows";

type CategoryUpdateResult = SettingsChangeResult | "duplicate";
type ErrorLike = { code?: string } | null;
const STATISTICS_GROUPS_SCHEMA_MISSING_CODES = new Set([
  "PGRST205",
  "PGRST204",
  "PGRST202",
  "42P01",
  "42703",
  "42883",
]);

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

export function isStatisticsGroupsSchemaMissing(error: ErrorLike | undefined): boolean {
  return Boolean(error?.code && STATISTICS_GROUPS_SCHEMA_MISSING_CODES.has(error.code));
}

export function mapStatisticsGroupSaveResult(error: ErrorLike): StatisticsGroupSaveResult {
  if (!error) return "saved";
  if (error.code === "23505") return "duplicate";
  if (error.code === "42501" || error.code === "P0001") return "forbidden";
  return "error";
}

export function mapStatisticsGroupChangeResult(error: ErrorLike): SettingsChangeResult {
  if (!error) return "updated";
  if (error.code === "42501" || error.code === "P0001") return "forbidden";
  return "error";
}

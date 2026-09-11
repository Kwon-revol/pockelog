import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

import {
  isStatisticsGroupsSchemaMissing,
  mapCategoryUpdateResult,
  mapStatisticsGroupChangeResult,
  mapStatisticsGroupSaveResult,
  resolveNextCategorySortOrder,
} from "@/features/settings/gateway-utils";
import { mapSettingsPageData } from "@/features/settings/query-utils";
import {
  getSettingsPageData,
  SettingsQueryError,
} from "@/features/settings/queries";

type QueryError = { code?: string; message: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };
type QueryBuilder<T> = Promise<QueryResult<T>> & {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function query<T>(result: QueryResult<T>): QueryBuilder<T> {
  const builder = Promise.resolve(result) as QueryBuilder<T>;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  return builder;
}

function settingsServerClient({
  statisticsGroupError = null,
  categoryError = null,
}: {
  statisticsGroupError?: QueryError | null;
  categoryError?: QueryError | null;
} = {}) {
  const privateProfileQuery = query({
    data: { default_ledger_id: "ledger-1" },
    error: null,
  });
  const ledgerQuery = query({
    data: { id: "ledger-1", name: "내 장부", period_start_day: 10 },
    error: null,
  });
  const memberQuery = query({ data: { role: "owner" as const }, error: null });
  const statisticsGroupQuery = query({
    data: statisticsGroupError ? null : [
      { id: "group-1", type: "expense" as const, name: "고정지출", color: "#64748B", sort_order: 0 },
    ],
    error: statisticsGroupError,
  });
  const currentCategoryQuery = query({
    data: categoryError ? null : [
      {
        id: "category-1",
        type: "expense" as const,
        name: "주거비",
        color: "#F97316",
        sort_order: 0,
        is_active: true,
        statistics_group_id: "group-1",
      },
    ],
    error: categoryError,
  });
  const legacyCategoryQuery = query({
    data: [{
      id: "category-1",
      type: "expense" as const,
      name: "주거비",
      color: "#F97316",
      sort_order: 0,
      is_active: true,
    }],
    error: null,
  });
  let categoryQueryCount = 0;
  const from = vi.fn((table: string) => {
    if (table === "user_private_profiles") return privateProfileQuery;
    if (table === "ledgers") return ledgerQuery;
    if (table === "ledger_members") return memberQuery;
    if (table === "statistics_groups") return statisticsGroupQuery;
    if (table === "categories") {
      categoryQueryCount += 1;
      return categoryQueryCount === 1 ? currentCategoryQuery : legacyCategoryQuery;
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from,
    },
    getCategoryQueryCount: () => categoryQueryCount,
  };
}

describe("settings query mapping", () => {
  it("maps owner role and sorts categories by type, order, and name", () => {
    const result = mapSettingsPageData(
      { id: "ledger-1", name: "내 장부", period_start_day: 10 },
      { role: "owner" },
      [
        { id: "3", type: "expense", name: "취미", color: "#8B5CF6", sort_order: 2, is_active: false, statistics_group_id: null },
        { id: "1", type: "income", name: "급여", color: "#10B981", sort_order: 0, is_active: true, statistics_group_id: null },
        { id: "2", type: "expense", name: "식비", color: "#F97316", sort_order: 0, is_active: true, statistics_group_id: null },
        { id: "4", type: "expense", name: "교통", color: "#3B82F6", sort_order: 2, is_active: true, statistics_group_id: null },
      ],
      [],
      true,
    );

    expect(result.ledger).toEqual({ id: "ledger-1", name: "내 장부", periodStartDay: 10 });
    expect(result.isOwner).toBe(true);
    expect(result.categories.map((category) => category.id)).toEqual(["2", "4", "3", "1"]);
    expect(result.categories[2]).toMatchObject({ name: "취미", isActive: false, sortOrder: 2 });
  });

  it("keeps a member in read-only mode and accepts a last-day period", () => {
    const result = mapSettingsPageData(
      { id: "ledger-1", name: "공동 장부", period_start_day: null },
      { role: "member" },
      [],
      [],
      false,
    );

    expect(result.isOwner).toBe(false);
    expect(result.ledger.periodStartDay).toBeNull();
    expect(result.statisticsGroupsAvailable).toBe(false);
  });

  it("maps statistics groups and derives their category membership", () => {
    const result = mapSettingsPageData(
      { id: "ledger-1", name: "내 장부", period_start_day: 10 },
      { role: "owner" },
      [
        { id: "category-2", type: "expense", name: "통신비", color: "#3B82F6", sort_order: 1, is_active: false, statistics_group_id: "group-1" },
        { id: "category-1", type: "expense", name: "주거비", color: "#F97316", sort_order: 0, is_active: true, statistics_group_id: "group-1" },
      ],
      [
        { id: "group-1", type: "expense", name: "고정지출", color: "#64748B", sort_order: 0 },
      ],
      true,
    );

    expect(result).toMatchObject({
      statisticsGroupsAvailable: true,
      statisticsGroups: [{
        id: "group-1",
        type: "expense",
        name: "고정지출",
        color: "#64748B",
        sortOrder: 0,
        categoryIds: ["category-1", "category-2"],
      }],
      categories: [
        { id: "category-1", statisticsGroupId: "group-1" },
        { id: "category-2", statisticsGroupId: "group-1" },
      ],
    });
  });
});

describe("settings gateway mapping", () => {
  it("increments the last category order and stops when the lookup failed", () => {
    expect(resolveNextCategorySortOrder({ sort_order: 4 }, null)).toBe(5);
    expect(resolveNextCategorySortOrder(null, null)).toBe(0);
    expect(resolveNextCategorySortOrder(null, { code: "PGRST001" })).toBeNull();
  });

  it("distinguishes missing rows, authorization failures, and server errors", () => {
    expect(mapCategoryUpdateResult(null, true)).toBe("updated");
    expect(mapCategoryUpdateResult(null, false)).toBe("forbidden");
    expect(mapCategoryUpdateResult("42501", false)).toBe("forbidden");
    expect(mapCategoryUpdateResult("23505", false)).toBe("duplicate");
    expect(mapCategoryUpdateResult("XX000", false)).toBe("error");
  });

  it.each(["PGRST205", "PGRST204", "PGRST202", "42P01", "42703", "42883"])(
    "recognizes only the supported schema-missing code %s",
    (code) => {
      expect(isStatisticsGroupsSchemaMissing({ code })).toBe(true);
    },
  );

  it.each([undefined, "", "PGRST001", "42501", "ECONNRESET"])(
    "does not hide a regular query failure with code %s",
    (code) => {
      expect(isStatisticsGroupsSchemaMissing(code === undefined ? null : { code })).toBe(false);
    },
  );

  it("maps statistics group RPC results without exposing database errors", () => {
    expect(mapStatisticsGroupSaveResult(null)).toBe("saved");
    expect(mapStatisticsGroupSaveResult({ code: "23505" })).toBe("duplicate");
    expect(mapStatisticsGroupSaveResult({ code: "42501" })).toBe("forbidden");
    expect(mapStatisticsGroupSaveResult({ code: "P0001" })).toBe("forbidden");
    expect(mapStatisticsGroupSaveResult({ code: "XX000" })).toBe("error");

    expect(mapStatisticsGroupChangeResult(null)).toBe("updated");
    expect(mapStatisticsGroupChangeResult({ code: "42501" })).toBe("forbidden");
    expect(mapStatisticsGroupChangeResult({ code: "P0001" })).toBe("forbidden");
    expect(mapStatisticsGroupChangeResult({ code: "23505" })).toBe("error");
  });
});

describe("getSettingsPageData", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
  });

  it("retries the legacy category projection for a named schema-missing error", async () => {
    const fake = settingsServerClient({
      statisticsGroupError: { code: "PGRST205", message: "table missing" },
      categoryError: { code: "PGRST204", message: "column missing" },
    });
    mocks.createServerClient.mockResolvedValue(fake.client);

    await expect(getSettingsPageData()).resolves.toMatchObject({
      statisticsGroupsAvailable: false,
      statisticsGroups: [],
      categories: [{ id: "category-1", statisticsGroupId: null }],
    });
    expect(fake.getCategoryQueryCount()).toBe(2);
  });

  it.each(["42501", "PGRST001"])(
    "surfaces the regular query error %s without a legacy retry",
    async (code) => {
      const fake = settingsServerClient({
        statisticsGroupError: { code, message: "provider details" },
      });
      mocks.createServerClient.mockResolvedValue(fake.client);

      await expect(getSettingsPageData()).rejects.toBeInstanceOf(SettingsQueryError);
      expect(fake.getCategoryQueryCount()).toBe(1);
    },
  );
});

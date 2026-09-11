import "server-only";

import type {
  CategoryStatisticsRow,
  PeriodStatisticsRow,
} from "@/features/statistics/query-utils";
import type { GroupedCategoryStatisticsRow } from "@/features/statistics/types";
import {
  StatisticsQueryError,
  type StatisticsGateway,
} from "@/features/statistics/workflows";
import { getInitialTransactionPageForCurrentUser } from "@/features/transactions/queries";
import { resolveTransactionContext } from "@/features/transactions/supabase-gateway";
import { createServerClient } from "@/shared/supabase/server";

function isMissingGroupedStatisticsRpc(error: { code?: string } | null) {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export async function createSupabaseStatisticsGateway(): Promise<StatisticsGateway> {
  const supabase = await createServerClient();
  return {
    async getContext() {
      const context = await resolveTransactionContext(supabase);
      if (!context) return null;
      const { data, error } = await supabase
        .from("ledgers")
        .select("id,name,period_start_day")
        .eq("id", context.ledgerId)
        .maybeSingle();
      if (error || !data) throw new Error("ledger query failed");
      return {
        userId: context.userId,
        ledger: {
          id: data.id,
          name: data.name,
          periodStartDay: data.period_start_day,
        },
      };
    },

    async getPeriodRows(ledgerId, periods) {
      const { data, error } = await supabase.rpc("get_period_statistics", {
        target_ledger_id: ledgerId,
        start_dates: periods.map((period) => period.startOn),
        end_dates: periods.map((period) => period.endExclusive),
      });
      if (error) throw new Error("period statistics query failed");
      return (data ?? []) as PeriodStatisticsRow[];
    },

    async getCategoryRows(ledgerId, period, type) {
      const args = {
        target_ledger_id: ledgerId,
        start_on: period.startOn,
        end_exclusive: period.endExclusive,
        target_type: type,
      };
      try {
        const { data, error } = await supabase.rpc("get_grouped_category_statistics", args);
        if (!error) return (data ?? []) as GroupedCategoryStatisticsRow[];
        if (!isMissingGroupedStatisticsRpc(error)) {
          throw new StatisticsQueryError("분류 통계를 불러오지 못했습니다.");
        }

        const { data: legacyData, error: legacyError } = await supabase.rpc(
          "get_category_statistics",
          args,
        );
        if (legacyError) throw new StatisticsQueryError("분류 통계를 불러오지 못했습니다.");
        const legacyRows = (legacyData ?? []) as CategoryStatisticsRow[];
        return legacyRows.map((row) => ({
          category_id: row.category_id,
          category_name: row.category_name,
          category_color: row.category_color,
          category_sort_order: row.sort_order,
          amount_total: row.amount_total,
          statistics_group_id: null,
          statistics_group_name: null,
          statistics_group_color: null,
          statistics_group_sort_order: null,
        }));
      } catch (error) {
        if (error instanceof StatisticsQueryError) throw error;
        throw new StatisticsQueryError("분류 통계를 불러오지 못했습니다.");
      }
    },

    getTransactionPage(filters) {
      return getInitialTransactionPageForCurrentUser(filters);
    },
  };
}

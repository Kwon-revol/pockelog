import "server-only";

import type {
  CategoryStatisticsRow,
  PeriodStatisticsRow,
} from "@/features/statistics/query-utils";
import type { StatisticsGateway } from "@/features/statistics/workflows";
import { getInitialTransactionPageForCurrentUser } from "@/features/transactions/queries";
import { resolveTransactionContext } from "@/features/transactions/supabase-gateway";
import { createServerClient } from "@/shared/supabase/server";

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
      const { data, error } = await supabase.rpc("get_category_statistics", {
        target_ledger_id: ledgerId,
        start_on: period.startOn,
        end_exclusive: period.endExclusive,
        target_type: type,
      });
      if (error) throw new Error("category statistics query failed");
      return (data ?? []) as CategoryStatisticsRow[];
    },

    getTransactionPage(filters) {
      return getInitialTransactionPageForCurrentUser(filters);
    },
  };
}

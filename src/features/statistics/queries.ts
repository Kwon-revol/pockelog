import "server-only";

import { createSupabaseStatisticsGateway } from "@/features/statistics/supabase-gateway";
import {
  loadStatisticsDetail,
  loadStatisticsOverview,
} from "@/features/statistics/workflows";

export async function getStatisticsOverviewData(now = new Date()) {
  return loadStatisticsOverview(now, await createSupabaseStatisticsGateway());
}

export async function getStatisticsDetailData(
  periodKey: string,
  type: string | undefined,
) {
  return loadStatisticsDetail(
    periodKey,
    type,
    await createSupabaseStatisticsGateway(),
  );
}

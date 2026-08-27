import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { StatisticsDetailScreen } from "@/features/statistics/detail-screen";
import { getStatisticsDetailData } from "@/features/statistics/queries";
import { statisticsDetailPath } from "@/features/statistics/routing";
import {
  StatisticsAuthenticationError,
  StatisticsPeriodError,
} from "@/features/statistics/workflows";

export const metadata: Metadata = { title: "상세 통계" };

export default async function StatisticsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ periodKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { periodKey } = await params;
  const query = await searchParams;
  const type = Array.isArray(query.type) ? query.type[0] : query.type;
  let data;
  try {
    data = await getStatisticsDetailData(periodKey, type);
  } catch (error) {
    if (error instanceof StatisticsAuthenticationError) {
      redirect(`/login?next=${encodeURIComponent(statisticsDetailPath(periodKey, type))}`);
    }
    if (error instanceof StatisticsPeriodError) notFound();
    throw error;
  }
  return <StatisticsDetailScreen initialData={data} />;
}

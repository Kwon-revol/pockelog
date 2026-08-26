import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StatisticsOverviewScreen } from "@/features/statistics/overview-screen";
import { getStatisticsOverviewData } from "@/features/statistics/queries";
import { StatisticsAuthenticationError } from "@/features/statistics/workflows";

export const metadata: Metadata = { title: "통계" };

export default async function StatisticsPage() {
  let data;
  try {
    data = await getStatisticsOverviewData();
  } catch (error) {
    if (error instanceof StatisticsAuthenticationError) redirect("/login?next=/statistics");
    throw error;
  }
  return <StatisticsOverviewScreen data={data} />;
}

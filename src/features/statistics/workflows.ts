import {
  toCategorySummaries,
  toPeriodSummaries,
  type CategoryStatisticsRow,
  type PeriodStatisticsRow,
} from "@/features/statistics/query-utils";
import type {
  StatisticsDetailData,
  StatisticsOverviewData,
} from "@/features/statistics/types";
import {
  getLedgerPeriodFromStart,
  listLedgerPeriods,
  type LedgerPeriod,
} from "@/features/transactions/period";
import type {
  TransactionFilters,
  TransactionPage,
  TransactionType,
} from "@/features/transactions/types";

export type StatisticsContext = {
  userId: string;
  ledger: { id: string; name: string; periodStartDay: number | null };
};

export interface StatisticsGateway {
  getContext(): Promise<StatisticsContext | null>;
  getPeriodRows(ledgerId: string, periods: LedgerPeriod[]): Promise<PeriodStatisticsRow[]>;
  getCategoryRows(
    ledgerId: string,
    period: LedgerPeriod,
    type: TransactionType,
  ): Promise<CategoryStatisticsRow[]>;
  getTransactionPage(filters: TransactionFilters): Promise<TransactionPage>;
}

export class StatisticsAuthenticationError extends Error {}
export class StatisticsQueryError extends Error {}
export class StatisticsPeriodError extends StatisticsQueryError {}

async function requireContext(gateway: StatisticsGateway) {
  try {
    const context = await gateway.getContext();
    if (!context) throw new StatisticsAuthenticationError("로그인이 필요합니다.");
    return context;
  } catch (error) {
    if (error instanceof StatisticsAuthenticationError) throw error;
    throw new StatisticsQueryError("장부 정보를 불러오지 못했습니다.");
  }
}

export async function loadStatisticsOverview(
  now: Date,
  gateway: StatisticsGateway,
): Promise<StatisticsOverviewData> {
  const context = await requireContext(gateway);
  const periods = listLedgerPeriods(now, context.ledger.periodStartDay, 12);
  try {
    const rows = await gateway.getPeriodRows(context.ledger.id, periods);
    return { ledger: context.ledger, periods: toPeriodSummaries(rows, periods) };
  } catch {
    throw new StatisticsQueryError("통계를 불러오지 못했습니다.");
  }
}

export async function loadStatisticsDetail(
  periodKey: string,
  requestedType: string | undefined,
  gateway: StatisticsGateway,
): Promise<StatisticsDetailData> {
  const context = await requireContext(gateway);
  const period = getLedgerPeriodFromStart(periodKey, context.ledger.periodStartDay);
  if (!period) throw new StatisticsPeriodError("잘못된 통계 기간입니다.");
  const type: TransactionType = requestedType === "income" ? "income" : "expense";
  const filters: TransactionFilters = {
    startOn: period.startOn,
    endOn: period.endOn,
    endExclusive: period.endExclusive,
    query: "",
    type,
    categoryId: null,
    sort: "newest",
  };

  try {
    const [periodRows, categoryRows, page] = await Promise.all([
      gateway.getPeriodRows(context.ledger.id, [period]),
      gateway.getCategoryRows(context.ledger.id, period, type),
      gateway.getTransactionPage(filters),
    ]);
    const summary = toPeriodSummaries(periodRows, [period])[0];
    const typeTotal = type === "expense" ? summary.expenseTotal : summary.incomeTotal;
    return {
      ledger: context.ledger,
      period: summary,
      type,
      categories: toCategorySummaries(categoryRows, typeTotal),
      typeTotal,
      filters,
      page,
    };
  } catch (error) {
    if (error instanceof StatisticsQueryError) throw error;
    throw new StatisticsQueryError("상세 통계를 불러오지 못했습니다.");
  }
}

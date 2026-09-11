import type { SettingsPageData } from "@/features/settings/types";
import type { TransactionType } from "@/features/transactions/types";

type LedgerRow = { id: string; name: string; period_start_day: number | null };
type MemberRow = { role: "owner" | "member" };
type CategoryRow = {
  id: string;
  type: TransactionType;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  statistics_group_id: string | null;
};
type StatisticsGroupRow = {
  id: string;
  type: TransactionType;
  name: string;
  color: string;
  sort_order: number;
};

const typeOrder: Record<TransactionType, number> = { expense: 0, income: 1 };

export function mapSettingsPageData(
  ledger: LedgerRow,
  member: MemberRow,
  categories: CategoryRow[],
  statisticsGroups: StatisticsGroupRow[],
  statisticsGroupsAvailable: boolean,
): SettingsPageData {
  const mappedCategories = categories
    .map((category) => ({
      id: category.id,
      type: category.type,
      name: category.name,
      color: category.color,
      sortOrder: category.sort_order,
      isActive: category.is_active,
      statisticsGroupId: category.statistics_group_id,
    }))
    .sort((left, right) => (
      typeOrder[left.type] - typeOrder[right.type]
      || left.sortOrder - right.sortOrder
      || left.name.localeCompare(right.name, "ko")
      || left.id.localeCompare(right.id)
    ));

  return {
    ledger: {
      id: ledger.id,
      name: ledger.name,
      periodStartDay: ledger.period_start_day,
    },
    isOwner: member.role === "owner",
    categories: mappedCategories,
    statisticsGroups: statisticsGroups
      .map((group) => ({
        id: group.id,
        type: group.type,
        name: group.name,
        color: group.color,
        sortOrder: group.sort_order,
        categoryIds: mappedCategories
          .filter((category) => category.statisticsGroupId === group.id)
          .map((category) => category.id),
      }))
      .sort((left, right) => (
        typeOrder[left.type] - typeOrder[right.type]
        || left.sortOrder - right.sortOrder
        || left.name.localeCompare(right.name, "ko")
        || left.id.localeCompare(right.id)
      )),
    statisticsGroupsAvailable,
  };
}

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
};

const typeOrder: Record<TransactionType, number> = { expense: 0, income: 1 };

export function mapSettingsPageData(
  ledger: LedgerRow,
  member: MemberRow,
  categories: CategoryRow[],
): SettingsPageData {
  return {
    ledger: {
      id: ledger.id,
      name: ledger.name,
      periodStartDay: ledger.period_start_day,
    },
    isOwner: member.role === "owner",
    categories: categories
      .map((category) => ({
        id: category.id,
        type: category.type,
        name: category.name,
        color: category.color,
        sortOrder: category.sort_order,
        isActive: category.is_active,
      }))
      .sort((left, right) => (
        typeOrder[left.type] - typeOrder[right.type]
        || left.sortOrder - right.sortOrder
        || left.name.localeCompare(right.name, "ko")
        || left.id.localeCompare(right.id)
      )),
  };
}

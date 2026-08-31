import { encodeTaxCursor } from "@/features/tax/cursor";
import type {
  TaxCategoryCode,
  TaxContributionPage,
} from "@/features/tax/types";

export type TaxContributionRow = {
  id: string;
  ledger_id: string;
  ledger_name: string;
  can_manage: boolean;
  occurred_on: string;
  description: string;
  amount: string | number;
  created_at: string;
  category_name: string;
  system_code: TaxCategoryCode;
};

export function toTaxContributionPage(rows: TaxContributionRow[]): TaxContributionPage {
  const hasNext = rows.length > 50;
  const items = rows.slice(0, 50).map((row) => ({
    id: row.id,
    ledgerId: row.ledger_id,
    ledgerName: row.ledger_name,
    canManage: row.can_manage,
    occurredOn: row.occurred_on,
    description: row.description,
    amount: Number(row.amount),
    createdAt: row.created_at,
    categoryName: row.category_name,
    systemCode: row.system_code,
  }));
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasNext && last
      ? encodeTaxCursor({
        occurredOn: last.occurredOn,
        createdAt: last.createdAt,
        id: last.id,
      })
      : null,
  };
}

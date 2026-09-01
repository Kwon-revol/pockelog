import type { LedgerPageData } from "@/features/transactions/types";

export function getLedgerScreenKey(data: LedgerPageData) {
  return JSON.stringify(data);
}

import type { TransactionType } from "@/features/transactions/types";

export type LedgerSettingsInput = {
  name: string;
  periodStartDay: number | null;
};

export type CategoryInput = {
  type: TransactionType;
  name: string;
  color: string;
};

export type SettingsCategory = CategoryInput & {
  id: string;
  sortOrder: number;
  isActive: boolean;
};

export type SettingsPageData = {
  ledger: {
    id: string;
    name: string;
    periodStartDay: number | null;
  };
  isOwner: boolean;
  categories: SettingsCategory[];
};

export type SettingsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialSettingsActionState: SettingsActionState = { status: "idle" };

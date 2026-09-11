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

export type StatisticsGroupInput = {
  type: TransactionType;
  name: string;
  color: string;
  categoryIds: string[];
};

export type SettingsStatisticsGroup = StatisticsGroupInput & {
  id: string;
  sortOrder: number;
};

export type SettingsCategory = CategoryInput & {
  id: string;
  sortOrder: number;
  isActive: boolean;
  statisticsGroupId?: string | null;
};

export type SettingsPageData = {
  ledger: {
    id: string;
    name: string;
    periodStartDay: number | null;
  };
  isOwner: boolean;
  categories: SettingsCategory[];
  statisticsGroups?: SettingsStatisticsGroup[];
  statisticsGroupsAvailable?: boolean;
};

export type SettingsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialSettingsActionState: SettingsActionState = { status: "idle" };

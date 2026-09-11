import { z } from "zod";

import type {
  CategoryInput,
  LedgerSettingsInput,
  SettingsActionState,
  StatisticsGroupInput,
} from "@/features/settings/types";
import type { TransactionType } from "@/features/transactions/types";

export type SettingsContext = {
  userId: string;
  ledgerId: string;
  isOwner: boolean;
};

export type SettingsChangeResult = "updated" | "forbidden" | "error";
export type CategoryCreateResult = "created" | "duplicate" | "forbidden" | "error";
export type StatisticsGroupSaveResult = "saved" | "duplicate" | "forbidden" | "error";

export interface SettingsGateway {
  getContext(): Promise<SettingsContext | null>;
  updateLedger(context: SettingsContext, input: LedgerSettingsInput): Promise<SettingsChangeResult>;
  createCategory(context: SettingsContext, input: CategoryInput): Promise<CategoryCreateResult>;
  updateCategory(context: SettingsContext, id: string, input: CategoryInput): Promise<SettingsChangeResult | "duplicate">;
  setCategoryActive(context: SettingsContext, id: string, active: boolean): Promise<SettingsChangeResult>;
  setCategoryOrder(context: SettingsContext, type: TransactionType, orderedIds: string[]): Promise<SettingsChangeResult>;
  saveStatisticsGroup(
    context: SettingsContext,
    groupId: string | null,
    input: StatisticsGroupInput,
  ): Promise<StatisticsGroupSaveResult>;
  deleteStatisticsGroup(context: SettingsContext, groupId: string): Promise<SettingsChangeResult>;
  setStatisticsGroupOrder(
    context: SettingsContext,
    type: TransactionType,
    orderedIds: string[],
  ): Promise<SettingsChangeResult>;
}

const OWNER_ONLY = "장부 소유자만 설정을 변경할 수 있어요.";
const SAVE_FAILED = "설정을 저장하지 못했습니다. 다시 시도해 주세요.";
const CATEGORY_FAILED = "분류를 변경하지 못했습니다. 다시 시도해 주세요.";
const DUPLICATE = "같은 이름의 분류가 이미 있어요.";
const STATISTICS_GROUP_FAILED = "통계 그룹을 변경하지 못했습니다. 다시 시도해 주세요.";
const STATISTICS_GROUP_DUPLICATE = "같은 이름의 통계 그룹이 있어요.";
const idSchema = z.uuid();

async function requireOwner(gateway: SettingsGateway): Promise<SettingsContext | SettingsActionState> {
  let context: SettingsContext | null;
  try {
    context = await gateway.getContext();
  } catch {
    return { status: "error", message: SAVE_FAILED };
  }
  if (!context) return { status: "error", message: "로그인이 필요합니다." };
  if (!context.isOwner) return { status: "error", message: OWNER_ONLY };
  return context;
}

function isActionState(value: SettingsContext | SettingsActionState): value is SettingsActionState {
  return "status" in value;
}

export async function updateLedgerSettings(
  input: LedgerSettingsInput,
  gateway: SettingsGateway,
): Promise<SettingsActionState> {
  const context = await requireOwner(gateway);
  if (isActionState(context)) return context;
  try {
    return await gateway.updateLedger(context, input) === "updated"
      ? { status: "success", message: "장부 설정을 저장했어요." }
      : { status: "error", message: SAVE_FAILED };
  } catch {
    return { status: "error", message: SAVE_FAILED };
  }
}

export async function createCategory(
  input: CategoryInput,
  gateway: SettingsGateway,
): Promise<SettingsActionState> {
  const context = await requireOwner(gateway);
  if (isActionState(context)) return context;
  try {
    const result = await gateway.createCategory(context, input);
    if (result === "created") return { status: "success", message: "분류를 추가했어요." };
    if (result === "duplicate") return { status: "error", message: DUPLICATE };
    return { status: "error", message: result === "forbidden" ? OWNER_ONLY : CATEGORY_FAILED };
  } catch {
    return { status: "error", message: CATEGORY_FAILED };
  }
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
  gateway: SettingsGateway,
): Promise<SettingsActionState> {
  if (!idSchema.safeParse(id).success) return { status: "error", message: CATEGORY_FAILED };
  const context = await requireOwner(gateway);
  if (isActionState(context)) return context;
  try {
    const result = await gateway.updateCategory(context, id, input);
    if (result === "updated") return { status: "success", message: "분류를 수정했어요." };
    if (result === "duplicate") return { status: "error", message: DUPLICATE };
    return { status: "error", message: result === "forbidden" ? OWNER_ONLY : CATEGORY_FAILED };
  } catch {
    return { status: "error", message: CATEGORY_FAILED };
  }
}

export async function setCategoryActive(
  id: string,
  active: boolean,
  gateway: SettingsGateway,
): Promise<SettingsActionState> {
  if (!idSchema.safeParse(id).success) return { status: "error", message: CATEGORY_FAILED };
  const context = await requireOwner(gateway);
  if (isActionState(context)) return context;
  try {
    const result = await gateway.setCategoryActive(context, id, active);
    if (result === "updated") {
      return { status: "success", message: active ? "분류를 다시 표시했어요." : "분류를 숨겼어요." };
    }
    return { status: "error", message: result === "forbidden" ? OWNER_ONLY : CATEGORY_FAILED };
  } catch {
    return { status: "error", message: CATEGORY_FAILED };
  }
}

export async function moveCategory(
  id: string,
  direction: "up" | "down",
  type: TransactionType,
  orderedIds: string[],
  gateway: SettingsGateway,
): Promise<SettingsActionState> {
  if (!idSchema.safeParse(id).success || orderedIds.some((value) => !idSchema.safeParse(value).success)) {
    return { status: "error", message: CATEGORY_FAILED };
  }
  const currentIndex = orderedIds.indexOf(id);
  const nextIndex = currentIndex + (direction === "up" ? -1 : 1);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) {
    return { status: "error", message: "더 이상 이동할 수 없어요." };
  }
  const nextOrder = [...orderedIds];
  [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
  const context = await requireOwner(gateway);
  if (isActionState(context)) return context;
  try {
    return await gateway.setCategoryOrder(context, type, nextOrder) === "updated"
      ? { status: "success", message: "분류 순서를 바꿨어요." }
      : { status: "error", message: CATEGORY_FAILED };
  } catch {
    return { status: "error", message: CATEGORY_FAILED };
  }
}

export async function saveStatisticsGroup(
  groupId: string | null,
  input: StatisticsGroupInput,
  gateway: SettingsGateway,
): Promise<SettingsActionState> {
  if (
    (groupId !== null && !idSchema.safeParse(groupId).success)
    || input.categoryIds.some((id) => !idSchema.safeParse(id).success)
  ) {
    return { status: "error", message: STATISTICS_GROUP_FAILED };
  }
  const context = await requireOwner(gateway);
  if (isActionState(context)) return context;
  try {
    const result = await gateway.saveStatisticsGroup(context, groupId, input);
    if (result === "saved") {
      return {
        status: "success",
        message: groupId === null ? "통계 그룹을 추가했어요." : "통계 그룹을 수정했어요.",
      };
    }
    if (result === "duplicate") return { status: "error", message: STATISTICS_GROUP_DUPLICATE };
    return { status: "error", message: result === "forbidden" ? OWNER_ONLY : STATISTICS_GROUP_FAILED };
  } catch {
    return { status: "error", message: STATISTICS_GROUP_FAILED };
  }
}

export async function deleteStatisticsGroup(
  groupId: string,
  gateway: SettingsGateway,
): Promise<SettingsActionState> {
  if (!idSchema.safeParse(groupId).success) {
    return { status: "error", message: STATISTICS_GROUP_FAILED };
  }
  const context = await requireOwner(gateway);
  if (isActionState(context)) return context;
  try {
    const result = await gateway.deleteStatisticsGroup(context, groupId);
    if (result === "updated") return { status: "success", message: "통계 그룹을 삭제했어요." };
    return { status: "error", message: result === "forbidden" ? OWNER_ONLY : STATISTICS_GROUP_FAILED };
  } catch {
    return { status: "error", message: STATISTICS_GROUP_FAILED };
  }
}

export async function moveStatisticsGroup(
  groupId: string,
  direction: "up" | "down",
  type: TransactionType,
  orderedIds: string[],
  gateway: SettingsGateway,
): Promise<SettingsActionState> {
  if (
    !idSchema.safeParse(groupId).success
    || orderedIds.some((id) => !idSchema.safeParse(id).success)
  ) {
    return { status: "error", message: STATISTICS_GROUP_FAILED };
  }
  const currentIndex = orderedIds.indexOf(groupId);
  const nextIndex = currentIndex + (direction === "up" ? -1 : 1);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) {
    return { status: "error", message: "더 이상 이동할 수 없어요." };
  }
  const nextOrder = [...orderedIds];
  [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
  const context = await requireOwner(gateway);
  if (isActionState(context)) return context;
  try {
    const result = await gateway.setStatisticsGroupOrder(context, type, nextOrder);
    if (result === "updated") return { status: "success", message: "통계 그룹 순서를 바꿨어요." };
    return { status: "error", message: result === "forbidden" ? OWNER_ONLY : STATISTICS_GROUP_FAILED };
  } catch {
    return { status: "error", message: STATISTICS_GROUP_FAILED };
  }
}

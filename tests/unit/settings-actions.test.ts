import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SettingsGateway } from "@/features/settings/workflows";

const mocks = vi.hoisted(() => ({
  createSupabaseSettingsGateway: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/settings/supabase-gateway", () => ({
  createSupabaseSettingsGateway: mocks.createSupabaseSettingsGateway,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  createStatisticsGroupAction,
  deleteStatisticsGroupAction,
  moveStatisticsGroupAction,
  updateStatisticsGroupAction,
} from "@/features/settings/actions";
import { initialSettingsActionState } from "@/features/settings/types";

const groupId = "66666666-6666-4666-8666-666666666666";
const categoryId = "33333333-3333-4333-8333-333333333333";
const context = {
  userId: "11111111-1111-4111-8111-111111111111",
  ledgerId: "22222222-2222-4222-8222-222222222222",
  isOwner: true,
};

function statisticsGroupFormData() {
  const formData = new FormData();
  formData.set("type", "expense");
  formData.set("name", " 고정지출 ");
  formData.set("color", "#64748b");
  formData.append("categoryIds", categoryId);
  return formData;
}

function gateway(overrides: Partial<SettingsGateway> = {}): SettingsGateway {
  return {
    async getContext() { return context; },
    async updateLedger() { return "updated"; },
    async createCategory() { return "created"; },
    async updateCategory() { return "updated"; },
    async setCategoryActive() { return "updated"; },
    async setCategoryOrder() { return "updated"; },
    async saveStatisticsGroup() { return "saved"; },
    async deleteStatisticsGroup() { return "updated"; },
    async setStatisticsGroupOrder() { return "updated"; },
    ...overrides,
  };
}

function expectOnlyStatisticsGroupConsumersRevalidated() {
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/statistics");
  expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/ledger");
  expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
}

describe("statistics group server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createSupabaseSettingsGateway.mockResolvedValue(gateway());
  });

  it.each([
    [createStatisticsGroupAction, new FormData(), "name"],
    [
      updateStatisticsGroupAction.bind(null, groupId),
      new FormData(),
      "name",
    ],
  ] as const)("returns field errors before creating a gateway", async (action, formData, field) => {
    const result = await action(initialSettingsActionState, formData);

    expect(result).toMatchObject({ status: "error", message: "입력한 내용을 확인해 주세요." });
    expect(result.fieldErrors?.[field]).toBeDefined();
    expect(mocks.createSupabaseSettingsGateway).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("validates and creates a statistics group before revalidating its consumers", async () => {
    const saveStatisticsGroup = vi.fn().mockResolvedValue("saved");
    mocks.createSupabaseSettingsGateway.mockResolvedValue(gateway({ saveStatisticsGroup }));

    await expect(
      createStatisticsGroupAction(initialSettingsActionState, statisticsGroupFormData()),
    ).resolves.toEqual({ status: "success", message: "통계 그룹을 추가했어요." });
    expect(saveStatisticsGroup).toHaveBeenCalledWith(context, null, {
      type: "expense",
      name: "고정지출",
      color: "#64748B",
      categoryIds: [categoryId],
    });
    expectOnlyStatisticsGroupConsumersRevalidated();
  });

  it("updates a statistics group before revalidating its consumers", async () => {
    await expect(
      updateStatisticsGroupAction(groupId, initialSettingsActionState, statisticsGroupFormData()),
    ).resolves.toEqual({ status: "success", message: "통계 그룹을 수정했어요." });
    expectOnlyStatisticsGroupConsumersRevalidated();
  });

  it("keeps a failed statistics group update on the current form", async () => {
    const saveStatisticsGroup = vi.fn().mockResolvedValue("duplicate");
    mocks.createSupabaseSettingsGateway.mockResolvedValue(gateway({ saveStatisticsGroup }));

    await expect(
      updateStatisticsGroupAction(groupId, initialSettingsActionState, statisticsGroupFormData()),
    ).resolves.toEqual({ status: "error", message: "같은 이름의 통계 그룹이 있어요." });
    expect(saveStatisticsGroup).toHaveBeenCalledWith(context, groupId, expect.any(Object));
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes a statistics group and revalidates only settings and statistics", async () => {
    await expect(deleteStatisticsGroupAction(groupId)).resolves.toEqual({
      status: "success",
      message: "통계 그룹을 삭제했어요.",
    });
    expectOnlyStatisticsGroupConsumersRevalidated();
  });

  it("moves a statistics group and revalidates only settings and statistics", async () => {
    const otherGroupId = "77777777-7777-4777-8777-777777777777";

    await expect(
      moveStatisticsGroupAction(groupId, "down", "expense", [groupId, otherGroupId]),
    ).resolves.toEqual({ status: "success", message: "통계 그룹 순서를 바꿨어요." });
    expectOnlyStatisticsGroupConsumersRevalidated();
  });
});

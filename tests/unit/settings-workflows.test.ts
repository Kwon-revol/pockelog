import { describe, expect, it } from "vitest";

import type { CategoryInput, LedgerSettingsInput } from "@/features/settings/types";
import {
  createCategory,
  moveCategory,
  setCategoryActive,
  updateCategory,
  updateLedgerSettings,
  type SettingsGateway,
} from "@/features/settings/workflows";

const context = {
  userId: "11111111-1111-4111-8111-111111111111",
  ledgerId: "22222222-2222-4222-8222-222222222222",
  isOwner: true,
};
const ledgerInput: LedgerSettingsInput = { name: "우리 집 장부", periodStartDay: 10 };
const categoryInput: CategoryInput = { type: "expense", name: "반려동물", color: "#A1B2C3" };

function gateway(overrides: Partial<SettingsGateway> = {}): SettingsGateway {
  return {
    async getContext() { return context; },
    async updateLedger() { return "updated"; },
    async createCategory() { return "created"; },
    async updateCategory() { return "updated"; },
    async setCategoryActive() { return "updated"; },
    async setCategoryOrder() { return "updated"; },
    ...overrides,
  };
}

describe("settings workflows", () => {
  it("updates the signed-in owner's default ledger", async () => {
    const result = await updateLedgerSettings(ledgerInput, gateway());
    expect(result).toEqual({ status: "success", message: "장부 설정을 저장했어요." });
  });

  it("does not mutate settings for a signed-out user or a member", async () => {
    let changed = false;
    const signedOut = gateway({
      async getContext() { return null; },
      async updateLedger() { changed = true; return "updated"; },
    });
    await expect(updateLedgerSettings(ledgerInput, signedOut)).resolves.toEqual({
      status: "error",
      message: "로그인이 필요합니다.",
    });

    const member = gateway({ async getContext() { return { ...context, isOwner: false }; } });
    await expect(createCategory(categoryInput, member)).resolves.toEqual({
      status: "error",
      message: "장부 소유자만 설정을 변경할 수 있어요.",
    });
    expect(changed).toBe(false);
  });

  it("maps duplicate category names to an actionable message", async () => {
    const duplicate = gateway({ async createCategory() { return "duplicate"; } });
    await expect(createCategory(categoryInput, duplicate)).resolves.toEqual({
      status: "error",
      message: "같은 이름의 분류가 이미 있어요.",
    });
  });

  it("updates and hides a category only within the current ledger", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    await expect(updateCategory(id, categoryInput, gateway())).resolves.toEqual({
      status: "success",
      message: "분류를 수정했어요.",
    });
    await expect(setCategoryActive(id, false, gateway())).resolves.toEqual({
      status: "success",
      message: "분류를 숨겼어요.",
    });
  });

  it("rejects malformed category identifiers before mutation", async () => {
    let changed = false;
    const invalid = gateway({ async updateCategory() { changed = true; return "updated"; } });
    await expect(updateCategory("wrong", categoryInput, invalid)).resolves.toMatchObject({ status: "error" });
    expect(changed).toBe(false);
  });

  it("moves a category by sending the complete reordered type list", async () => {
    const sent: string[][] = [];
    const ordered = [
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ];
    const result = await moveCategory(
      "44444444-4444-4444-8444-444444444444",
      "up",
      "expense",
      ordered,
      gateway({ async setCategoryOrder(_context, _type, ids) { sent.push(ids); return "updated"; } }),
    );

    expect(result).toEqual({ status: "success", message: "분류 순서를 바꿨어요." });
    expect(sent).toEqual([[
      "44444444-4444-4444-8444-444444444444",
      "33333333-3333-4333-8333-333333333333",
      "55555555-5555-4555-8555-555555555555",
    ]]);
  });

  it("does not call ordering at a list boundary", async () => {
    let changed = false;
    const ids = [
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    const result = await moveCategory(ids[0], "up", "expense", ids, gateway({
      async setCategoryOrder() { changed = true; return "updated"; },
    }));

    expect(result).toEqual({ status: "error", message: "더 이상 이동할 수 없어요." });
    expect(changed).toBe(false);
  });
});

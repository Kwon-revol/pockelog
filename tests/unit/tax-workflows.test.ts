import { describe, expect, it } from "vitest";

import {
  saveTaxProfile,
  type TaxGateway,
} from "@/features/tax/workflows";

const input = { taxYear: 2026 as const, grossSalary: 55_000_000 };

function createGateway(overrides: Partial<TaxGateway> = {}): TaxGateway {
  return {
    async getSessionUserId() { return "11111111-1111-4111-8111-111111111111"; },
    async upsertProfile() { return "saved"; },
    ...overrides,
  };
}

describe("saveTaxProfile", () => {
  it("does not save a profile when the session has no user", async () => {
    let mutated = false;
    const gateway = createGateway({
      async getSessionUserId() { return null; },
      async upsertProfile() { mutated = true; return "saved"; },
    });

    await expect(saveTaxProfile(gateway, input)).resolves.toEqual({
      status: "error",
      message: "로그인이 필요합니다.",
    });
    expect(mutated).toBe(false);
  });

  it("returns a safe message when row-level security rejects the save", async () => {
    const gateway = createGateway({ async upsertProfile() { return "forbidden"; } });

    await expect(saveTaxProfile(gateway, input)).resolves.toEqual({
      status: "error",
      message: "본인의 세금 정보만 변경할 수 있습니다.",
    });
  });

  it("asks the user to retry when saving fails unexpectedly", async () => {
    const gateway = createGateway({ async upsertProfile() { return "error"; } });

    await expect(saveTaxProfile(gateway, input)).resolves.toEqual({
      status: "error",
      message: "총급여를 저장하지 못했습니다. 다시 시도해 주세요.",
    });
  });

  it("saves the gross salary for the authenticated user", async () => {
    const saved: Array<{ userId: string; taxYear: 2026; grossSalary: number }> = [];
    const gateway = createGateway({
      async upsertProfile(userId, profile) {
        saved.push({ userId, ...profile });
        return "saved";
      },
    });

    await expect(saveTaxProfile(gateway, input)).resolves.toEqual({
      status: "success",
      message: "총급여를 저장했어요.",
    });
    expect(saved).toEqual([{
      userId: "11111111-1111-4111-8111-111111111111",
      taxYear: 2026,
      grossSalary: 55_000_000,
    }]);
  });
});

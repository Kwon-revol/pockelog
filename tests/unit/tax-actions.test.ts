import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseTaxGateway: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/tax/supabase-gateway", () => ({
  createSupabaseTaxGateway: mocks.createSupabaseTaxGateway,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveTaxProfileAction } from "@/features/tax/actions";

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("saveTaxProfileAction", () => {
  it("returns Zod field errors for an invalid tax profile form", async () => {
    const result = await saveTaxProfileAction(
      { status: "idle" },
      formData({ taxYear: "2025", grossSalary: "-1" }),
    );

    expect(result).toMatchObject({
      status: "error",
      message: "입력한 내용을 확인해 주세요.",
      fieldErrors: {
        taxYear: expect.any(Array),
        grossSalary: expect.any(Array),
      },
    });
  });

  it("returns the save workflow result and revalidates tax goals after success", async () => {
    mocks.createSupabaseTaxGateway.mockResolvedValue({
      async getSessionUserId() { return "11111111-1111-4111-8111-111111111111"; },
      async upsertProfile() { return "saved"; },
    });

    await expect(
      saveTaxProfileAction(
        { status: "idle" },
        formData({ taxYear: "2026", grossSalary: "55,000,000" }),
      ),
    ).resolves.toEqual({ status: "success", message: "총급여를 저장했어요." });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/tax-goals");
  });
});

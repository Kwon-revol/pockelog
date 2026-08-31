import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

import { createSupabaseTaxGateway } from "@/features/tax/supabase-gateway";

describe("createSupabaseTaxGateway", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
  });

  it.each([
    [null, "saved"],
    [{ code: "42501" }, "forbidden"],
    [{ code: "22023" }, "error"],
  ] as const)("saves through the authenticated tax-profile RPC and maps %j", async (error, expected) => {
    const rpc = vi.fn().mockResolvedValue({ error });
    mocks.createServerClient.mockResolvedValue({
      auth: { getUser: vi.fn() },
      rpc,
    });
    const gateway = await createSupabaseTaxGateway();

    await expect(gateway.upsertProfile(
      "11111111-1111-4111-8111-111111111111",
      { taxYear: 2026, grossSalary: 55_000_000 },
    )).resolves.toBe(expected);
    expect(rpc).toHaveBeenCalledWith("upsert_my_tax_profile", {
      target_year: 2026,
      target_gross_salary: 55_000_000,
    });
  });
});

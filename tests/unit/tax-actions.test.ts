import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createSupabaseTaxGateway: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/features/tax/supabase-gateway", () => ({
  createSupabaseTaxGateway: mocks.createSupabaseTaxGateway,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/shared/supabase/server", () => ({ createServerClient: mocks.createServerClient }));

import {
  openTaxContributionAction,
  saveTaxProfileAction,
} from "@/features/tax/actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const actualLedgerId = "33333333-3333-4333-8333-333333333333";

function openActionClient({
  user = { id: userId },
  transaction = { id: transactionId, ledger_id: actualLedgerId, created_by: userId },
  membership = { ledger_id: actualLedgerId },
  updatedProfile = { user_id: userId },
}: {
  user?: { id: string } | null;
  transaction?: { id: string; ledger_id: string; created_by: string } | null;
  membership?: { ledger_id: string } | null;
  updatedProfile?: { user_id: string } | null;
} = {}) {
  const transactionQuery = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(),
  };
  transactionQuery.select.mockReturnValue(transactionQuery);
  transactionQuery.eq.mockReturnValue(transactionQuery);
  transactionQuery.is.mockReturnValue(transactionQuery);
  transactionQuery.maybeSingle.mockResolvedValue({ data: transaction, error: null });

  const membershipQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  membershipQuery.select.mockReturnValue(membershipQuery);
  membershipQuery.eq.mockReturnValue(membershipQuery);
  membershipQuery.maybeSingle.mockResolvedValue({ data: membership, error: null });

  const profileQuery = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
  profileQuery.update.mockReturnValue(profileQuery);
  profileQuery.eq.mockReturnValue(profileQuery);
  profileQuery.select.mockReturnValue(profileQuery);
  profileQuery.maybeSingle.mockResolvedValue({ data: updatedProfile, error: null });

  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from: vi.fn((table: string) => {
        if (table === "transactions") return transactionQuery;
        if (table === "ledger_members") return membershipQuery;
        if (table === "user_private_profiles") return profileQuery;
        throw new Error(`unexpected table: ${table}`);
      }),
    },
    transactionQuery,
    membershipQuery,
    profileQuery,
  };
}

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

describe("openTaxContributionAction", () => {
  it("rejects an unauthenticated request before looking up a transaction", async () => {
    const fake = openActionClient({ user: null });
    mocks.createServerClient.mockResolvedValue(fake.client);

    await expect(openTaxContributionAction(transactionId)).resolves.toEqual({
      status: "error",
      message: "로그인이 필요합니다.",
    });
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it("rejects a transaction when the author is no longer a current ledger member", async () => {
    const fake = openActionClient({ membership: null });
    mocks.createServerClient.mockResolvedValue(fake.client);

    await expect(openTaxContributionAction(transactionId)).resolves.toEqual({
      status: "error",
      message: "이 납입 내역을 편집할 수 없습니다.",
    });
    expect(fake.profileQuery.update).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("derives the real ledger from the authored active transaction before opening its editor", async () => {
    const fake = openActionClient();
    mocks.createServerClient.mockResolvedValue(fake.client);
    mocks.redirect.mockImplementation((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); });

    await expect(openTaxContributionAction(transactionId)).rejects.toThrow(
      `NEXT_REDIRECT:/ledger?edit=${transactionId}`,
    );

    expect(fake.transactionQuery.eq).toHaveBeenCalledWith("id", transactionId);
    expect(fake.transactionQuery.eq).toHaveBeenCalledWith("created_by", userId);
    expect(fake.transactionQuery.is).toHaveBeenCalledWith("deleted_at", null);
    expect(fake.membershipQuery.eq).toHaveBeenCalledWith("ledger_id", actualLedgerId);
    expect(fake.membershipQuery.eq).toHaveBeenCalledWith("user_id", userId);
    expect(fake.profileQuery.update).toHaveBeenCalledWith({ default_ledger_id: actualLedgerId });
    expect(fake.profileQuery.eq).toHaveBeenCalledWith("user_id", userId);
    expect(mocks.redirect).toHaveBeenCalledWith(`/ledger?edit=${transactionId}`);
  });
});

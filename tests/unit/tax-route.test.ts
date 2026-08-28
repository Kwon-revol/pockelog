import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TaxAuthenticationError extends Error {}
  class TaxQueryError extends Error {}
  return {
    getTaxContributionPage: vi.fn(),
    TaxAuthenticationError,
    TaxQueryError,
  };
});

vi.mock("@/features/tax/queries", () => ({
  getTaxContributionPage: mocks.getTaxContributionPage,
  TaxAuthenticationError: mocks.TaxAuthenticationError,
  TaxQueryError: mocks.TaxQueryError,
}));

import { GET } from "@/app/api/tax-contributions/route";
import { encodeTaxCursor } from "@/features/tax/cursor";

const cursor = {
  occurredOn: "2026-08-26",
  createdAt: "2026-08-26T01:02:03.000Z",
  id: "11111111-1111-4111-8111-111111111111",
};

function request(query: string) {
  return { nextUrl: new URL(`http://localhost/api/tax-contributions?${query}`) } as Parameters<typeof GET>[0];
}

describe("tax contribution page route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    "year=2025&cursor=broken",
    `year=2027&cursor=${encodeTaxCursor(cursor)}`,
    `year=02026&cursor=${encodeTaxCursor(cursor)}`,
    "year=2026&cursor=broken",
    "year=2026",
  ])("rejects unsupported years and malformed or missing cursors: %s", async (query) => {
    const response = await GET(request(query));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "잘못된 조회 요청입니다." });
    expect(mocks.getTaxContributionPage).not.toHaveBeenCalled();
  });

  it("returns only the contribution page for a valid 2026 cursor", async () => {
    const page = {
      items: [{
        id: "33333333-3333-4333-8333-333333333333",
        ledgerId: "22222222-2222-4222-8222-222222222222",
        ledgerName: "내 장부",
        canManage: true,
        occurredOn: "2026-08-26",
        description: "IRP 납입",
        amount: 100_000,
        createdAt: "2026-08-26T01:02:03.000Z",
        categoryName: "IRP",
        systemCode: "irp",
      }],
      nextCursor: null,
    };
    mocks.getTaxContributionPage.mockResolvedValue(page);

    const response = await GET(request(`year=2026&cursor=${encodeTaxCursor(cursor)}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(page);
    expect(body).not.toHaveProperty("grossSalary");
    expect(body).not.toHaveProperty("result");
    expect(mocks.getTaxContributionPage).toHaveBeenCalledWith(2026, cursor);
  });

  it.each([
    [new mocks.TaxAuthenticationError(), 401, "로그인이 필요합니다."],
    [new mocks.TaxQueryError(), 500, "내역을 불러오지 못했습니다."],
    [new Error("unexpected"), 500, "잠시 후 다시 시도해 주세요."],
  ] as const)("maps query failures to a safe response", async (error, status, message) => {
    mocks.getTaxContributionPage.mockRejectedValue(error);

    const response = await GET(request(`year=2026&cursor=${encodeTaxCursor(cursor)}`));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ message });
  });
});

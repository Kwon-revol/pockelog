import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

import {
  decodeTaxCursor,
  encodeTaxCursor,
} from "@/features/tax/cursor";
import {
  getTaxContributionPage,
  getTaxPageData,
  TaxAuthenticationError,
  TaxQueryError,
} from "@/features/tax/queries";
import {
  toTaxContributionPage,
  type TaxContributionRow,
} from "@/features/tax/query-utils";
import type { TaxContributionPage } from "@/features/tax/types";
import {
  fetchContributionPage,
  useContributionPages,
  type LoadContributionPage,
} from "@/features/tax/use-contribution-pages";

const taxCursor = {
  occurredOn: "2026-08-26",
  createdAt: "2026-08-26T01:02:03.000Z",
  id: "11111111-1111-4111-8111-111111111111",
};

function encodeRawCursor(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function contributionRows(count: number): TaxContributionRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000000`,
    ledger_id: "22222222-2222-4222-8222-222222222222",
    ledger_name: index === 0 ? "우리 집" : "내 장부",
    can_manage: index !== 0,
    occurred_on: "2026-08-26",
    description: `납입 ${index + 1}`,
    amount: index === 0 ? "123000" : 100_000,
    created_at: `2026-08-26T01:02:03.${String(index).padStart(3, "0")}Z`,
    category_name: index === 0 ? "연금저축" : "IRP",
    system_code: index === 0 ? "pension_savings" : "irp",
  }));
}

type QueryResult<T> = { data: T; error: null | { message: string } };

function serverClient(options: {
  user?: { id: string } | null;
  profile?: QueryResult<{ gross_salary: string | number } | null>;
  summary?: QueryResult<Array<{ pension_paid: string | number; irp_paid: string | number }>>;
  contributions?: QueryResult<TaxContributionRow[]>;
} = {}) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: options.user === undefined ? { id: "user-1" } : options.user },
    error: null,
  });
  const maybeSingle = vi.fn().mockResolvedValue(
    options.profile ?? { data: { gross_salary: "55000000" }, error: null },
  );
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string) => {
    if (table !== "user_tax_profiles") throw new Error(`unexpected table: ${table}`);
    return { select };
  });
  const rpc = vi.fn((name: string) => {
    if (name === "get_my_pension_tax_summary") {
      return Promise.resolve(options.summary ?? {
        data: [{ pension_paid: "6000000", irp_paid: "3000000" }],
        error: null,
      });
    }
    if (name === "get_my_pension_contributions") {
      return Promise.resolve(options.contributions ?? {
        data: contributionRows(1),
        error: null,
      });
    }
    throw new Error(`unexpected RPC: ${name}`);
  });

  return {
    client: { auth: { getUser }, from, rpc },
    spies: { getUser, from, select, eq, maybeSingle, rpc },
  };
}

describe("tax contribution cursor and row mapping", () => {
  it("round-trips the complete descending tuple cursor", () => {
    expect(decodeTaxCursor(encodeTaxCursor(taxCursor), 2026)).toEqual(taxCursor);
  });

  it.each([
    "%%%%",
    Buffer.from("not json").toString("base64url"),
    Buffer.from(JSON.stringify({ ...taxCursor, occurredOn: "2026-02-30" })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...taxCursor, createdAt: "yesterday" })).toString("base64url"),
    Buffer.from(JSON.stringify({ ...taxCursor, id: "not-a-uuid" })).toString("base64url"),
  ])("rejects malformed Base64, dates, and UUIDs: %s", (value) => {
    expect(decodeTaxCursor(value, 2026)).toBeNull();
  });

  it.each(["2025-12-31", "2027-01-01"])(
    "rejects a valid cursor date outside the expected tax year: %s",
    (occurredOn) => {
      expect(decodeTaxCursor(encodeTaxCursor({ ...taxCursor, occurredOn }), 2026)).toBeNull();
    },
  );

  it("rejects an encoded cursor with additional fields", () => {
    expect(decodeTaxCursor(encodeRawCursor({ ...taxCursor, userId: "user-2" }), 2026)).toBeNull();
  });

  it("maps RPC rows and uses the fiftieth visible row as the next tuple cursor", () => {
    const page = toTaxContributionPage(contributionRows(51));

    expect(page.items).toHaveLength(50);
    expect(page.items[0]).toEqual({
      id: "00000001-0000-4000-8000-000000000000",
      ledgerId: "22222222-2222-4222-8222-222222222222",
      ledgerName: "우리 집",
      canManage: false,
      occurredOn: "2026-08-26",
      description: "납입 1",
      amount: 123_000,
      createdAt: "2026-08-26T01:02:03.000Z",
      categoryName: "연금저축",
      systemCode: "pension_savings",
    });
    expect(page.items.at(-1)?.description).toBe("납입 50");
    expect(decodeTaxCursor(page.nextCursor, 2026)).toEqual({
      occurredOn: "2026-08-26",
      createdAt: "2026-08-26T01:02:03.049Z",
      id: "00000050-0000-4000-8000-000000000000",
    });
  });

  it("does not expose a next cursor when fifty rows or fewer are returned", () => {
    expect(toTaxContributionPage(contributionRows(50)).nextCursor).toBeNull();
  });
});

describe("tax server queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads auth, profile, summary, and the first 51-row page without a user-id input", async () => {
    const fake = serverClient();
    mocks.createServerClient.mockResolvedValue(fake.client);

    const result = await getTaxPageData(2026);

    expect(result).toMatchObject({
      taxYear: 2026,
      supportedYears: [2026],
      grossSalary: 55_000_000,
      rule: { year: 2026, ruleVersion: "kr-employment-pension-2026-v1" },
      result: {
        pensionPaid: 6_000_000,
        irpPaid: 3_000_000,
        estimatedTotalBenefit: 1_485_000,
      },
      contributions: { items: expect.any(Array), nextCursor: null },
    });
    expect(fake.spies.getUser).toHaveBeenCalledWith();
    expect(fake.spies.from).toHaveBeenCalledWith("user_tax_profiles");
    expect(fake.spies.eq).toHaveBeenCalledWith("tax_year", 2026);
    expect(fake.spies.rpc).toHaveBeenCalledWith("get_my_pension_tax_summary", {
      target_year: 2026,
    });
    expect(fake.spies.rpc).toHaveBeenCalledWith("get_my_pension_contributions", {
      target_year: 2026,
      page_size: 51,
      after_on: null,
      after_created_at: null,
      after_id: null,
    });
  });

  it("keeps the result null when gross salary has not been saved", async () => {
    const fake = serverClient({ profile: { data: null, error: null } });
    mocks.createServerClient.mockResolvedValue(fake.client);

    await expect(getTaxPageData(2026)).resolves.toMatchObject({
      grossSalary: null,
      result: null,
    });
  });

  it("passes the complete tuple cursor to the contribution RPC", async () => {
    const fake = serverClient();
    mocks.createServerClient.mockResolvedValue(fake.client);

    await getTaxContributionPage(2026, taxCursor);

    expect(fake.spies.rpc).toHaveBeenCalledWith("get_my_pension_contributions", {
      target_year: 2026,
      page_size: 51,
      after_on: "2026-08-26",
      after_created_at: "2026-08-26T01:02:03.000Z",
      after_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(fake.spies.rpc.mock.calls.flat()).not.toContain("user-1");
  });

  it("distinguishes signed-out sessions from safe database query failures", async () => {
    const signedOut = serverClient({ user: null });
    mocks.createServerClient.mockResolvedValueOnce(signedOut.client);
    await expect(getTaxPageData(2026)).rejects.toBeInstanceOf(TaxAuthenticationError);

    const failed = serverClient({
      summary: { data: [], error: { message: "secret database detail" } },
    });
    mocks.createServerClient.mockResolvedValueOnce(failed.client);
    const error = await getTaxPageData(2026).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TaxQueryError);
    expect((error as Error).message).not.toContain("secret database detail");
  });

  it("wraps rejected database transports without leaking their details", async () => {
    const failed = serverClient();
    failed.spies.rpc.mockRejectedValueOnce(new Error("secret transport detail"));
    mocks.createServerClient.mockResolvedValue(failed.client);

    const error = await getTaxPageData(2026).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TaxQueryError);
    expect((error as Error).message).not.toContain("secret transport detail");
  });

  it("rejects unsupported years before opening a server client", async () => {
    await expect(getTaxPageData(2025)).rejects.toBeInstanceOf(TaxQueryError);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
});

let observerCallback: IntersectionObserverCallback | null = null;

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  root = null;
  rootMargin = "0px";
  thresholds = [0];
  takeRecords() { return []; }
}

function ContributionPagesHarness({
  initialPage,
  loadPage,
}: {
  initialPage: TaxContributionPage;
  loadPage: LoadContributionPage;
}) {
  const pages = useContributionPages(initialPage, 2026, loadPage);
  return createElement(
    "div",
    null,
    createElement("output", { "data-testid": "tax-contribution-ids" }, pages.items.map((item) => item.id).join(",")),
    pages.hasNext
      ? createElement("div", { "data-testid": "tax-contribution-sentinel", ref: pages.sentinelRef })
      : null,
    pages.loadError ? createElement("p", { role: "alert" }, pages.loadError) : null,
    createElement("button", { onClick: () => void pages.requestNextPage(), type: "button" }, "다시 시도"),
  );
}

describe("tax contribution automatic pages", () => {
  beforeEach(() => {
    observerCallback = null;
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts one request per cursor, removes duplicate IDs, and drops the final sentinel", async () => {
    const initial = toTaxContributionPage(contributionRows(1));
    initial.nextCursor = "cursor-1";
    const duplicate = initial.items[0];
    const next = { ...duplicate, id: "44444444-4444-4444-8444-444444444444", description: "추가 납입" };
    let resolvePage!: (page: TaxContributionPage) => void;
    const pending = new Promise<TaxContributionPage>((resolve) => { resolvePage = resolve; });
    const loadPage = vi.fn(() => pending);
    render(createElement(ContributionPagesHarness, { initialPage: initial, loadPage }));

    await act(async () => {
      const entry = [{ isIntersecting: true } as IntersectionObserverEntry];
      observerCallback?.(entry, {} as IntersectionObserver);
      observerCallback?.(entry, {} as IntersectionObserver);
    });
    expect(loadPage).toHaveBeenCalledTimes(1);
    expect(loadPage).toHaveBeenCalledWith(2026, "cursor-1");

    await act(async () => {
      resolvePage({ items: [duplicate, next, next], nextCursor: null });
    });
    await waitFor(() => expect(screen.queryByTestId("tax-contribution-sentinel")).not.toBeInTheDocument());
    expect(screen.getByTestId("tax-contribution-ids")).toHaveTextContent(`${duplicate.id},${next.id}`);
  });

  it("retries the same cursor after a load failure", async () => {
    const initial = toTaxContributionPage(contributionRows(1));
    initial.nextCursor = "retry-cursor";
    const loadPage = vi.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    render(createElement(ContributionPagesHarness, { initialPage: initial, loadPage }));

    await act(async () => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("추가 납입 내역을 불러오지 못했습니다.");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    });
    expect(loadPage).toHaveBeenNthCalledWith(1, 2026, "retry-cursor");
    expect(loadPage).toHaveBeenNthCalledWith(2, 2026, "retry-cursor");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("requests only the contribution-page API contract", async () => {
    const page = { items: [], nextCursor: null };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(page));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchContributionPage(2026, "cursor-value")).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tax-contributions?year=2026&cursor=cursor-value",
    );
  });
});

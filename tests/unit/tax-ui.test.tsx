import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaxScreen } from "@/features/tax/tax-screen";
import type { TaxPageData } from "@/features/tax/types";
import type { TaxActionState } from "@/features/tax/workflows";

const pageMocks = vi.hoisted(() => {
  class TaxAuthenticationError extends Error {}
  class TaxQueryError extends Error {}
  return {
    getTaxPageData: vi.fn(),
    redirect: vi.fn(),
    TaxAuthenticationError,
    TaxQueryError,
  };
});

vi.mock("next/navigation", () => ({
  redirect: pageMocks.redirect,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/tax/queries", () => ({
  getTaxPageData: pageMocks.getTaxPageData,
  TaxAuthenticationError: pageMocks.TaxAuthenticationError,
  TaxQueryError: pageMocks.TaxQueryError,
}));

vi.mock("@/features/tax/actions", () => ({
  saveTaxProfileAction: saveProfileAction,
}));

const contribution = {
  id: "11111111-1111-4111-8111-111111111111",
  ledgerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ledgerName: "내 장부",
  canManage: true,
  occurredOn: "2026-08-20",
  description: "8월 연금저축",
  amount: 7_000_000,
  createdAt: "2026-08-20T01:00:00.000Z",
  categoryName: "연금저축",
  systemCode: "pension_savings" as const,
};

const data: TaxPageData = {
  taxYear: 2026,
  supportedYears: [2026],
  grossSalary: 50_000_000,
  pensionPaid: 7_000_000,
  irpPaid: 4_000_000,
  rule: {
    year: 2026,
    pensionLimit: 6_000_000,
    combinedLimit: 9_000_000,
    salaryThreshold: 55_000_000,
    ruleVersion: "kr-employment-pension-2026-v1",
  },
  result: {
    pensionPaid: 7_000_000,
    irpPaid: 4_000_000,
    pensionEligible: 6_000_000,
    irpEligible: 3_000_000,
    totalEligible: 9_000_000,
    pensionRemaining: 0,
    totalRemaining: 0,
    pensionExcess: 1_000_000,
    irpExcess: 1_000_000,
    incomeTaxRate: 0.15,
    incomeTaxCredit: 1_350_000,
    localIncomeTaxEffect: 135_000,
    estimatedTotalBenefit: 1_485_000,
    ruleVersion: "kr-employment-pension-2026-v1",
  },
  contributions: {
    items: [
      contribution,
      {
        ...contribution,
        id: "22222222-2222-4222-8222-222222222222",
        ledgerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        ledgerName: "예전 가족 장부",
        canManage: false,
        occurredOn: "2026-07-20",
        description: "예전 IRP",
        amount: 4_000_000,
        systemCode: "irp",
        categoryName: "IRP",
      },
    ],
    nextCursor: null,
  },
};

const saveProfileAction = async (): Promise<TaxActionState> => ({ status: "success" });
let observerCallback: IntersectionObserverCallback | null = null;

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) { observerCallback = callback; }
  observe() {}
  unobserve() {}
  disconnect() {}
  root = null;
  rootMargin = "0px";
  thresholds = [0];
  takeRecords() { return []; }
}

function renderScreen(overrides: Partial<React.ComponentProps<typeof TaxScreen>> = {}) {
  return render(
    <TaxScreen
      editAction={async () => ({ status: "success" })}
      initialData={data}
      saveProfileAction={saveProfileAction}
      {...overrides}
    />,
  );
}

describe("TaxScreen", () => {
  beforeEach(() => {
    observerCallback = null;
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the 2026 employee tax overview and exact add links", () => {
    renderScreen();

    expect(screen.getByRole("heading", { name: "세금" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "과세연도" })).toHaveValue("2026");
    expect(screen.getByRole("option", { name: "2026년" })).toHaveProperty("selected", true);
    expect(screen.getByText("근로소득자")).toBeVisible();
    expect(screen.getByRole("link", { name: "연금저축 추가" })).toHaveAttribute("href", "/ledger?new=pension_savings");
    expect(screen.getByRole("link", { name: "IRP 추가" })).toHaveAttribute("href", "/ledger?new=irp");
  });

  it("keeps contribution status visible without salary and hides estimated calculation amounts", () => {
    renderScreen({
      initialData: {
        ...data,
        grossSalary: null,
        pensionPaid: 2_000_000,
        irpPaid: 1_000_000,
        result: null,
      },
    });

    expect(screen.getByRole("textbox", { name: /총급여/ })).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByText("총급여를 입력하면 예상 세액공제를 계산할 수 있어요.")).toBeVisible();
    expect(screen.getByText("연금저축 납입액").parentElement).toHaveTextContent("2,000,000원");
    expect(screen.getByText("IRP 납입액").parentElement).toHaveTextContent("1,000,000원");
    expect(screen.queryByText("소득세 세액공제 예상액")).not.toBeInTheDocument();
    expect(screen.queryByText("1,485,000원")).not.toBeInTheDocument();
  });

  it("exposes capped progress while retaining actual, remaining, and excess amounts", () => {
    renderScreen();

    const pension = screen.getByRole("progressbar", { name: "연금저축 공제 한도 진행률" });
    expect(pension).toHaveAttribute("aria-valuenow", "6000000");
    expect(pension).toHaveAttribute("aria-valuemax", "6000000");
    const combined = screen.getByRole("progressbar", { name: "전체 공제 한도 진행률" });
    expect(combined).toHaveAttribute("aria-valuenow", "9000000");
    expect(combined).toHaveAttribute("aria-valuemax", "9000000");

    const status = screen.getByRole("region", { name: "2026년 연금 납입 현황" });
    expect(within(status).getByText("연금저축 납입액").parentElement).toHaveTextContent("7,000,000원");
    expect(within(status).getByText("전체 남은 한도").parentElement).toHaveTextContent("0원");
    expect(within(status).getByText("한도 초과 납입액").parentElement).toHaveTextContent("2,000,000원");
  });

  it("does not double-count pension excess before salary is saved", () => {
    renderScreen({ initialData: { ...data, grossSalary: null, result: null } });

    expect(screen.getByText("한도 초과 납입액").parentElement).toHaveTextContent("2,000,000원");
  });

  it("separates each estimated tax effect and links the approved official sources", () => {
    renderScreen();

    expect(screen.getByText("소득세 세액공제 예상액").parentElement).toHaveTextContent("1,350,000원");
    expect(screen.getByText("지방소득세 감소 예상액").parentElement).toHaveTextContent("135,000원");
    expect(screen.getByText("총 예상 절세액").parentElement).toHaveTextContent("1,485,000원");
    expect(screen.getByText(/실제 공제 및 환급액은 결정세액/)).toBeVisible();
    expect(screen.getByRole("link", { name: "소득세법 제59조의3" })).toHaveAttribute(
      "href",
      "https://law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900470390",
    );
    expect(screen.getByRole("link", { name: "국세청 연금계좌 세액공제 안내" })).toHaveAttribute(
      "href",
      "https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875&mi=6596",
    );
  });

  it("offers edit only for manageable current-ledger contributions", () => {
    renderScreen();

    expect(screen.getByRole("button", { name: "8월 연금저축 편집" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "예전 IRP 편집" })).not.toBeInTheDocument();
    const former = screen.getByRole("listitem", { name: /예전 IRP/ });
    expect(within(former).getByText("이전 장부")).toBeVisible();
    expect(within(former).queryByText("예전 가족 장부")).not.toBeInTheDocument();
    expect(within(former).getByText("읽기 전용")).toBeVisible();
  });

  it("automatically appends the next contribution page without end-of-list copy", async () => {
    const nextItem = {
      ...contribution,
      id: "33333333-3333-4333-8333-333333333333",
      description: "9월 IRP",
      systemCode: "irp" as const,
      categoryName: "IRP",
    };
    const loadPage = vi.fn().mockResolvedValue({ items: [nextItem], nextCursor: null });
    renderScreen({
      initialData: { ...data, contributions: { ...data.contributions, nextCursor: "cursor-1" } },
      loadPage,
    });

    await act(async () => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    await waitFor(() => expect(screen.getByRole("listitem", { name: /9월 IRP/ })).toBeVisible());
    expect(loadPage).toHaveBeenCalledWith(2026, "cursor-1");
    expect(screen.queryByText("모든 납입 내역을 확인했어요")).not.toBeInTheDocument();
  });

  it("retries the same cursor after an automatic-page error", async () => {
    const user = userEvent.setup();
    const recovered = { ...contribution, id: "44444444-4444-4444-8444-444444444444", description: "재시도 IRP" };
    const loadPage = vi.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ items: [recovered], nextCursor: null });
    renderScreen({
      initialData: { ...data, contributions: { ...data.contributions, nextCursor: "cursor-retry" } },
      loadPage,
    });

    await act(async () => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("추가 납입 내역을 불러오지 못했습니다.");

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByRole("listitem", { name: /재시도 IRP/ })).toBeVisible();
    expect(loadPage).toHaveBeenNthCalledWith(1, 2026, "cursor-retry");
    expect(loadPage).toHaveBeenNthCalledWith(2, 2026, "cursor-retry");
  });

  it("keeps the same tax information accessible at a mobile viewport", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    renderScreen();

    expect(screen.getByRole("region", { name: "2026년 연금 납입 현황" })).toBeVisible();
    expect(screen.getByRole("region", { name: "예상 절세 결과" })).toBeVisible();
    expect(screen.getByRole("region", { name: "연금 납입 내역" })).toBeVisible();
    expect(screen.getByRole("link", { name: "연금저축 추가" })).toBeVisible();
    expect(screen.getByRole("button", { name: "8월 연금저축 편집" })).toBeVisible();
  });
});

describe("TaxGoalsPage", () => {
  beforeEach(() => {
    pageMocks.getTaxPageData.mockReset();
    pageMocks.redirect.mockReset();
  });

  afterEach(cleanup);

  it("redirects an unauthenticated session to login with the tax return path", async () => {
    pageMocks.getTaxPageData.mockRejectedValue(new pageMocks.TaxAuthenticationError());
    pageMocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
    const { default: TaxGoalsPage } = await import("@/app/(app)/tax-goals/page");

    await expect(TaxGoalsPage()).rejects.toThrow("redirect:/login?next=%2Ftax-goals");
  });

  it("renders retry guidance for a tax query failure", async () => {
    pageMocks.getTaxPageData.mockRejectedValue(new pageMocks.TaxQueryError());
    const { default: TaxGoalsPage } = await import("@/app/(app)/tax-goals/page");

    render(await TaxGoalsPage());

    expect(screen.getByRole("heading", { name: "세금 정보를 불러오지 못했어요" })).toBeVisible();
    expect(screen.getByText(/페이지를 새로고침해 다시 시도/)).toBeVisible();
  });
});

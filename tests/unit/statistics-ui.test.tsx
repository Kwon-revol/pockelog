import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StatisticsDetailScreen } from "@/features/statistics/detail-screen";
import { StatisticsOverviewScreen } from "@/features/statistics/overview-screen";
import type { StatisticsDetailData, StatisticsOverviewData } from "@/features/statistics/types";
import type { TransactionPage } from "@/features/transactions/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const overviewFixture: StatisticsOverviewData = {
  ledger: { id: "ledger-1", name: "내 장부", periodStartDay: 10 },
  periods: [
    {
      key: "2026-08-10",
      startOn: "2026-08-10",
      endOn: "2026-09-09",
      endExclusive: "2026-09-10",
      incomeTotal: 3000000,
      expenseTotal: 800000,
      balance: 2200000,
    },
    {
      key: "2026-07-10",
      startOn: "2026-07-10",
      endOn: "2026-08-09",
      endExclusive: "2026-08-10",
      incomeTotal: 0,
      expenseTotal: 0,
      balance: 0,
    },
    {
      key: "2026-06-10",
      startOn: "2026-06-10",
      endOn: "2026-07-09",
      endExclusive: "2026-07-10",
      incomeTotal: 100000,
      expenseTotal: 300000,
      balance: -200000,
    },
  ],
};

const detailFixture: StatisticsDetailData = {
  ledger: overviewFixture.ledger,
  period: overviewFixture.periods[0],
  type: "expense",
  categories: [
    { categoryId: "food", name: "식비", color: "#F97316", amountTotal: 30000, ratio: 75, sortOrder: 1 },
    { categoryId: "hobby", name: "취미", color: "#8B5CF6", amountTotal: 10000, ratio: 25, sortOrder: 2 },
  ],
  typeTotal: 40000,
  filters: {
    startOn: "2026-08-10",
    endOn: "2026-09-09",
    endExclusive: "2026-09-10",
    query: "",
    type: "expense",
    categoryId: null,
    sort: "newest",
  },
  page: {
    items: [{
      id: "33333333-3333-4333-8333-333333333333",
      type: "expense",
      occurredOn: "2026-08-26",
      description: "점심",
      amount: 30000,
      memo: "",
      category: { id: "food", name: "식비", color: "#F97316", type: "expense" },
      createdAt: "2026-08-26T01:00:00.000Z",
    }],
    nextCursor: null,
  },
};

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

describe("StatisticsOverviewScreen", () => {
  afterEach(cleanup);

  it("shows period totals and links each card to its detail", () => {
    render(<StatisticsOverviewScreen data={overviewFixture} />);
    const current = screen.getByRole("link", { name: /2026년 8월 10일.*2026년 9월 9일/ });
    expect(current).toHaveAttribute("href", "/statistics/2026-08-10");
    expect(within(current).getByText("수입 3,000,000원")).toBeVisible();
    expect(within(current).getByText("지출 800,000원")).toBeVisible();
    expect(within(current).getByText("차액 +2,200,000원")).toBeVisible();
  });

  it("compares income and expense against the larger amount", () => {
    render(<StatisticsOverviewScreen data={overviewFixture} />);
    const current = screen.getByRole("link", { name: /2026년 8월 10일.*2026년 9월 9일/ });
    expect(within(current).getByRole("progressbar", { name: "수입 비율" })).toHaveAttribute("aria-valuenow", "100");
    expect(within(current).getByRole("progressbar", { name: "지출 비율" })).toHaveAttribute("aria-valuenow", "27");
  });

  it("labels an empty period and formats a negative balance", () => {
    render(<StatisticsOverviewScreen data={overviewFixture} />);
    expect(screen.getByRole("link", { name: /2026년 7월 10일.*기록 없음/ })).toBeVisible();
    expect(screen.getByText("차액 -200,000원")).toBeVisible();
  });
});

describe("StatisticsDetailScreen", () => {
  beforeEach(() => {
    observerCallback = null;
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows category ratios, a type switch, and read-only source transactions", () => {
    render(<StatisticsDetailScreen initialData={detailFixture} />);
    expect(screen.getByRole("heading", { name: "분류별 지출" })).toBeVisible();
    const categories = screen.getByRole("region", { name: "분류별 지출 비율" });
    expect(within(categories).getByText("식비")).toBeVisible();
    expect(within(categories).getByText("75%")).toBeVisible();
    expect(screen.getByRole("link", { name: "수입" })).toHaveAttribute("href", "?type=income");
    expect(screen.getByRole("region", { name: "거래 내역" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /점심/ })).not.toBeInTheDocument();
  });

  it("loads the next source page once when the sentinel enters view", async () => {
    const nextItem = { ...detailFixture.page.items[0], id: "44444444-4444-4444-8444-444444444444", description: "저녁" };
    const loadPage = vi.fn<() => Promise<TransactionPage>>().mockResolvedValue({ items: [nextItem], nextCursor: null });
    render(
      <StatisticsDetailScreen
        initialData={{ ...detailFixture, page: { ...detailFixture.page, nextCursor: "cursor-1" } }}
        loadPage={loadPage}
      />,
    );

    await act(async () => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    await waitFor(() => expect(screen.getAllByText("저녁").length).toBeGreaterThan(0));
    expect(loadPage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("모든 내역을 확인했어요")).not.toBeInTheDocument();
  });

  it("replaces source transactions when the selected type changes", () => {
    const { rerender } = render(<StatisticsDetailScreen initialData={detailFixture} />);
    expect(screen.getAllByText("점심").length).toBeGreaterThan(0);

    const incomeData: StatisticsDetailData = {
      ...detailFixture,
      type: "income",
      typeTotal: 100000,
      filters: { ...detailFixture.filters, type: "income" },
      categories: [{ categoryId: "side", name: "부수입", color: "#10B981", amountTotal: 100000, ratio: 100, sortOrder: 2 }],
      page: {
        items: [{
          ...detailFixture.page.items[0],
          id: "55555555-5555-4555-8555-555555555555",
          type: "income",
          description: "프로젝트 수입",
          amount: 100000,
          category: { id: "side", name: "부수입", color: "#10B981", type: "income" },
        }],
        nextCursor: null,
      },
    };
    rerender(<StatisticsDetailScreen initialData={incomeData} />);

    expect(screen.queryByText("점심")).not.toBeInTheDocument();
    expect(screen.getAllByText("프로젝트 수입").length).toBeGreaterThan(0);
  });
});

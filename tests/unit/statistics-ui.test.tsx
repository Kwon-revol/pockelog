import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatisticsOverviewScreen } from "@/features/statistics/overview-screen";
import type { StatisticsOverviewData } from "@/features/statistics/types";

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

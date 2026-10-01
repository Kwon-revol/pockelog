import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/shared/ui/app-shell";

const navigationState = vi.hoisted(() => ({ pathname: "/ledger" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
    navigationState.pathname = "/ledger";
  });

  it("hides the unused tax destination and evenly divides mobile navigation by visible items", () => {
    render(
      <AppShell
        currentLedger={{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }}
        ledgers={[{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }]}
        pendingInvitationCount={0}
        switchLedgerAction={async () => ({ status: "success" })}
        userName="권혁"
      >
        <h1>가계부 내용</h1>
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: "세금" })).not.toBeInTheDocument();
    const mobileNavigation = screen.getByRole("navigation", { name: "모바일 주 메뉴" });
    expect(within(mobileNavigation).getAllByRole("link")).toHaveLength(3);
    expect(mobileNavigation).toHaveStyle({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" });
  });

  it("floats the mobile navigation inside a rounded card above the screen edge", () => {
    render(
      <AppShell
        currentLedger={{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }}
        ledgers={[{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }]}
        pendingInvitationCount={0}
        switchLedgerAction={async () => ({ status: "success" })}
        userName="권혁"
      >
        <h1>가계부 내용</h1>
      </AppShell>,
    );

    const mobileNavigationCard = screen.getByRole("navigation", { name: "모바일 주 메뉴" }).parentElement;
    expect(mobileNavigationCard).toHaveClass(
      "inset-x-6",
      "bottom-[calc(0.75rem+env(safe-area-inset-bottom))]",
      "rounded-[1.375rem]",
      "border",
      "p-[3px]",
      "shadow-[0_12px_40px_rgba(15,23,42,0.18)]",
    );
    expect(mobileNavigationCard).not.toHaveClass("inset-x-0", "bottom-0");
    expect(within(mobileNavigationCard!).getByRole("link", { name: "가계부" })).toHaveClass("min-h-13");
  });

  it("shows icon-only mobile tabs while preserving accessible and desktop labels", () => {
    render(
      <AppShell
        currentLedger={{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }}
        ledgers={[{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }]}
        pendingInvitationCount={0}
        switchLedgerAction={async () => ({ status: "success" })}
        userName="권혁"
      >
        <h1>가계부 내용</h1>
      </AppShell>,
    );

    const mobileNavigation = screen.getByRole("navigation", { name: "모바일 주 메뉴" });
    for (const label of ["가계부", "통계", "설정"]) {
      expect(within(mobileNavigation).getByRole("link", { name: label })).toBeInTheDocument();
      expect(within(mobileNavigation).getByText(label)).toHaveClass("sr-only");
      expect(within(screen.getByRole("navigation", { name: "주 메뉴" })).getByText(label)).not.toHaveClass("sr-only");
    }
  });

  it("shows the current ledger, user, and the three visible primary destinations", () => {
    render(
      <AppShell
        currentLedger={{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }}
        ledgers={[{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }]}
        pendingInvitationCount={0}
        switchLedgerAction={async () => ({ status: "success" })}
        userName="권혁"
      >
        <h1>가계부 내용</h1>
      </AppShell>,
    );

    expect(screen.getAllByText("PockeLog").length).toBeGreaterThan(0);
    expect(screen.getAllByText("권님의 장부").length).toBeGreaterThan(0);
    expect(screen.getByText("권혁님")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "가계부 내용" })).toBeInTheDocument();

    for (const label of ["가계부", "통계", "설정"]) {
      expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0);
    }
  });

  it("marks the current destination as selected in mobile and desktop navigation", () => {
    navigationState.pathname = "/statistics";
    render(
      <AppShell
        currentLedger={{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }}
        ledgers={[{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }]}
        pendingInvitationCount={0}
        switchLedgerAction={async () => ({ status: "success" })}
        userName="권혁"
      >
        <h1>통계 내용</h1>
      </AppShell>,
    );

    for (const link of screen.getAllByRole("link", { name: "통계" })) {
      expect(link).toHaveAttribute("aria-current", "page");
      expect(link).toHaveClass("bg-emerald-50", "text-emerald-800");
    }
    for (const link of screen.getAllByRole("link", { name: "가계부" })) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("keeps a parent destination selected on nested routes", () => {
    navigationState.pathname = "/settings/trash";
    render(
      <AppShell
        currentLedger={{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }}
        ledgers={[{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }]}
        pendingInvitationCount={0}
        switchLedgerAction={async () => ({ status: "success" })}
        userName="권혁"
      >
        <h1>휴지통</h1>
      </AppShell>,
    );

    for (const link of screen.getAllByRole("link", { name: "설정" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("switches between personal and shared ledgers from the common shell", async () => {
    const user = userEvent.setup();
    const switchLedgerAction = vi.fn(async () => ({ status: "success" as const }));
    render(
      <AppShell
        currentLedger={{ id: "11111111-1111-4111-8111-111111111111", name: "내 장부", kind: "personal", role: "owner" }}
        ledgers={[
          { id: "11111111-1111-4111-8111-111111111111", name: "내 장부", kind: "personal", role: "owner" },
          { id: "22222222-2222-4222-8222-222222222222", name: "우리 집", kind: "shared", role: "member" },
        ]}
        pendingInvitationCount={1}
        switchLedgerAction={switchLedgerAction}
        userName="권혁"
      >
        <h1>가계부 내용</h1>
      </AppShell>,
    );

    const selectors = screen.getAllByRole("combobox", { name: "현재 장부" });
    expect(selectors.length).toBeGreaterThan(0);
    expect(screen.getByText("받은 초대 1개")).toBeVisible();
    expect(screen.getByRole("link", { name: "설정 열기, 받은 초대 1개" })).toBeInTheDocument();
    await user.selectOptions(selectors[0], "22222222-2222-4222-8222-222222222222");
    expect(switchLedgerAction).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");
  });

  it("keeps both responsive ledger selectors synchronized with server props", () => {
    const personal = { id: "11111111-1111-4111-8111-111111111111", name: "내 장부", kind: "personal" as const, role: "owner" as const };
    const shared = { id: "22222222-2222-4222-8222-222222222222", name: "우리 집", kind: "shared" as const, role: "member" as const };
    const props = {
      ledgers: [personal, shared],
      pendingInvitationCount: 0,
      switchLedgerAction: async () => ({ status: "success" as const }),
      userName: "권혁",
    };
    const { rerender } = render(<AppShell {...props} currentLedger={personal}><h1>내용</h1></AppShell>);

    rerender(<AppShell {...props} currentLedger={shared}><h1>내용</h1></AppShell>);

    for (const selector of screen.getAllByRole("combobox", { name: "현재 장부" })) {
      expect(selector).toHaveValue(shared.id);
    }
  });
});

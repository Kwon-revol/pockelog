import { cleanup, render, screen } from "@testing-library/react";
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

  it("shows the current ledger, user, and the four primary destinations", () => {
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

    for (const label of ["가계부", "통계", "세금", "설정"]) {
      expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0);
    }
  });

  it("marks the current destination as selected in mobile and desktop navigation", () => {
    navigationState.pathname = "/tax-goals";
    render(
      <AppShell
        currentLedger={{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }}
        ledgers={[{ id: "11111111-1111-4111-8111-111111111111", name: "권님의 장부", kind: "personal", role: "owner" }]}
        pendingInvitationCount={0}
        switchLedgerAction={async () => ({ status: "success" })}
        userName="권혁"
      >
        <h1>세금 내용</h1>
      </AppShell>,
    );

    for (const link of screen.getAllByRole("link", { name: "세금" })) {
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

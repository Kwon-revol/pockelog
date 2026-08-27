import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/shared/ui/app-shell";

describe("AppShell", () => {
  afterEach(cleanup);

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
});

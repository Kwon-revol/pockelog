import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/shared/ui/app-shell";

describe("AppShell", () => {
  it("shows the current ledger, user, and the four primary destinations", () => {
    render(
      <AppShell ledgerName="권님의 장부" userName="권혁">
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
});

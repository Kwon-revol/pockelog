import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsScreen } from "@/features/settings/settings-screen";
import type { SettingsActionState, SettingsPageData } from "@/features/settings/types";

const data: SettingsPageData = {
  ledger: { id: "ledger-1", name: "내 장부", periodStartDay: 10 },
  isOwner: true,
  categories: [
    { id: "11111111-1111-4111-8111-111111111111", type: "expense", name: "식비", color: "#F97316", sortOrder: 0, isActive: true },
    { id: "22222222-2222-4222-8222-222222222222", type: "expense", name: "교통", color: "#3B82F6", sortOrder: 1, isActive: true },
    { id: "33333333-3333-4333-8333-333333333333", type: "expense", name: "예전 분류", color: "#64748B", sortOrder: 2, isActive: false },
    { id: "44444444-4444-4444-8444-444444444444", type: "income", name: "급여", color: "#10B981", sortOrder: 0, isActive: true },
  ],
};

const successFormAction = async (): Promise<SettingsActionState> => ({ status: "success" });
const successChangeAction = async (): Promise<SettingsActionState> => ({ status: "success", message: "변경했어요." });

function renderScreen(overrides: Partial<React.ComponentProps<typeof SettingsScreen>> = {}) {
  return render(
    <SettingsScreen
      data={data}
      updateLedgerAction={successFormAction}
      createCategoryAction={successFormAction}
      updateCategoryAction={async () => ({ status: "success" })}
      setCategoryActiveAction={successChangeAction}
      moveCategoryAction={successChangeAction}
      logoutAction={async () => undefined}
      {...overrides}
    />,
  );
}

describe("SettingsScreen", () => {
  beforeEach(() => vi.stubGlobal("confirm", vi.fn(() => true)));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the current ledger name and settlement start day", () => {
    renderScreen();
    expect(screen.getByRole("heading", { name: "설정" })).toBeVisible();
    expect(screen.getByLabelText("장부 이름")).toHaveValue("내 장부");
    expect(screen.getByLabelText("정산 시작일")).toHaveValue("10");
    expect(screen.getByRole("option", { name: "말일" })).toBeInTheDocument();
  });

  it("switches category types and opens add and edit panels", async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByText("식비")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "수입 분류" }));
    expect(screen.getByText("급여")).toBeVisible();
    expect(screen.queryByText("식비")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "분류 추가" }));
    expect(screen.getByRole("dialog", { name: "수입 분류 추가" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "닫기" }));

    await user.click(screen.getByRole("button", { name: "급여 수정" }));
    const dialog = screen.getByRole("dialog", { name: "급여 분류 수정" });
    expect(within(dialog).getByLabelText("분류 이름")).toHaveValue("급여");
  });

  it("disables impossible moves and exposes hidden categories for restoration", async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByRole("button", { name: "식비 위로 이동" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "교통 아래로 이동" })).toBeDisabled();
    await user.click(screen.getByText("숨긴 분류 1개"));
    expect(screen.getByText("예전 분류")).toBeVisible();
    expect(screen.getByRole("button", { name: "예전 분류 다시 표시" })).toBeVisible();
  });

  it("keeps members read-only", () => {
    renderScreen({ data: { ...data, isOwner: false } });
    expect(screen.getByText(/장부 소유자만 설정을 변경할 수 있어요/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "분류 추가" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "장부 설정 저장" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("장부 이름")).toBeDisabled();
  });

  it("shows an action result from an immediate category change", async () => {
    const user = userEvent.setup();
    renderScreen({ setCategoryActiveAction: vi.fn(successChangeAction) });
    await user.click(screen.getByRole("button", { name: "교통 숨기기" }));
    expect(await screen.findByRole("status")).toHaveTextContent("변경했어요.");
  });

  it("shows a retry message when an immediate category action is rejected", async () => {
    const user = userEvent.setup();
    renderScreen({ setCategoryActiveAction: async () => { throw new Error("network down"); } });

    await user.click(screen.getByRole("button", { name: "교통 숨기기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("분류를 변경하지 못했습니다. 다시 시도해 주세요.");
  });

  it("disables immediate category controls while a request is pending", async () => {
    const user = userEvent.setup();
    let finish!: (state: SettingsActionState) => void;
    const pending = new Promise<SettingsActionState>((resolve) => { finish = resolve; });
    renderScreen({ setCategoryActiveAction: () => pending });

    const hide = screen.getByRole("button", { name: "교통 숨기기" });
    await user.click(hide);
    await waitFor(() => expect(hide).toBeDisabled());
    finish({ status: "success", message: "분류를 숨겼어요." });
    expect(await screen.findByRole("status")).toHaveTextContent("분류를 숨겼어요.");
  });
});

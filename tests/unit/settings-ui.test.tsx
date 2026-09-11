import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsScreen } from "@/features/settings/settings-screen";
import type { ProfilePageData } from "@/features/profile/types";
import type { SettingsActionState, SettingsPageData } from "@/features/settings/types";

const data: SettingsPageData = {
  ledger: { id: "ledger-1", name: "내 장부", periodStartDay: 10 },
  isOwner: true,
  categories: [
    { id: "11111111-1111-4111-8111-111111111111", type: "expense", name: "식비", color: "#F97316", sortOrder: 0, isActive: true, statisticsGroupId: null },
    { id: "22222222-2222-4222-8222-222222222222", type: "expense", name: "교통", color: "#3B82F6", sortOrder: 1, isActive: true, statisticsGroupId: null },
    { id: "33333333-3333-4333-8333-333333333333", type: "expense", name: "예전 분류", color: "#64748B", sortOrder: 2, isActive: false, statisticsGroupId: null },
    { id: "55555555-5555-4555-8555-555555555555", type: "expense", name: "주거비", color: "#8B5CF6", sortOrder: 3, isActive: true, statisticsGroupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    { id: "66666666-6666-4666-8666-666666666666", type: "expense", name: "통신비", color: "#EC4899", sortOrder: 4, isActive: true, statisticsGroupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    { id: "77777777-7777-4777-8777-777777777777", type: "expense", name: "연금저축", color: "#10B981", sortOrder: 5, isActive: true, statisticsGroupId: null },
    { id: "44444444-4444-4444-8444-444444444444", type: "income", name: "급여", color: "#10B981", sortOrder: 0, isActive: true, statisticsGroupId: null },
  ],
  statisticsGroups: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      type: "expense",
      name: "고정지출",
      color: "#64748B",
      sortOrder: 0,
      categoryIds: [
        "55555555-5555-4555-8555-555555555555",
        "66666666-6666-4666-8666-666666666666",
      ],
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      type: "expense",
      name: "유동지출",
      color: "#F97316",
      sortOrder: 1,
      categoryIds: [],
    },
  ],
  statisticsGroupsAvailable: true,
};

const successFormAction = async (): Promise<SettingsActionState> => ({ status: "success" });
const successChangeAction = async (): Promise<SettingsActionState> => ({ status: "success", message: "변경했어요." });
const profileData: ProfilePageData = { displayName: "포켓", email: "pocket@example.com", phone: "01012345678" };
const successProfileAction = async () => ({ status: "success" as const });

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
      profileData={profileData}
      updateProfileAction={successProfileAction}
      changePasswordAction={successProfileAction}
      statisticsGroupActions={{
        createAction: successFormAction,
        updateAction: async () => ({ status: "success" }),
        deleteAction: successChangeAction,
        moveAction: successChangeAction,
      }}
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
    expect(screen.getByRole("button", { name: "연금저축 아래로 이동" })).toBeDisabled();
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

  it("shows my profile controls to members as well as ledger owners", () => {
    renderScreen({ data: { ...data, isOwner: false } });

    expect(screen.getByRole("heading", { name: "내 프로필" })).toBeVisible();
    expect(screen.getByRole("button", { name: "프로필 저장" })).toBeVisible();
  });

  it("shows trash data management only to the owner", () => {
    renderScreen();
    expect(screen.getByRole("link", { name: "휴지통 보기" })).toHaveAttribute("href", "/settings/trash");

    cleanup();
    renderScreen({ data: { ...data, isOwner: false } });
    expect(screen.queryByRole("link", { name: "휴지통 보기" })).not.toBeInTheDocument();
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

  it("shows groups, unassigned categories, and lets the owner create a group", async () => {
    const user = userEvent.setup();
    const createStatisticsGroupAction = vi.fn(successFormAction);
    renderScreen({
      statisticsGroupActions: {
        createAction: createStatisticsGroupAction,
        updateAction: async () => ({ status: "success" }),
        deleteAction: successChangeAction,
        moveAction: successChangeAction,
      },
    });

    const region = screen.getByRole("region", { name: "통계 그룹 관리" });
    expect(within(region).getByText("고정지출")).toBeVisible();
    expect(within(region).getByText(/주거비/)).toBeVisible();
    expect(within(region).getByText(/통신비/)).toBeVisible();
    expect(within(region).getByText(/그룹 미지정.*식비/)).toBeVisible();

    await user.click(within(region).getByRole("button", { name: "통계 그룹 추가" }));
    expect(within(region).getAllByRole("button", { name: /색상 선택/ })).toHaveLength(6);
    await user.type(within(region).getByLabelText("그룹 이름"), "저축");
    await user.click(within(region).getByLabelText("연금저축"));
    await user.click(within(region).getByRole("button", { name: "그룹 저장" }));

    await waitFor(() => expect(createStatisticsGroupAction).toHaveBeenCalled());
  });

  it("warns before moving a category and labels hidden categories in the form", async () => {
    const user = userEvent.setup();
    renderScreen();
    const region = screen.getByRole("region", { name: "통계 그룹 관리" });

    await user.click(within(region).getByRole("button", { name: "통계 그룹 추가" }));
    await user.click(within(region).getByLabelText("주거비"));

    expect(within(region).getByText("저장하면 기존 그룹에서 이 그룹으로 이동해요.")).toBeVisible();
    expect(within(region).getByLabelText("예전 분류")).toBeVisible();
    expect(within(region).getByText("숨김")).toBeVisible();
  });

  it("lets the owner edit, reorder, and confirm deletion", async () => {
    const user = userEvent.setup();
    const moveAction = vi.fn(successChangeAction);
    const deleteAction = vi.fn(successChangeAction);
    renderScreen({
      statisticsGroupActions: {
        createAction: successFormAction,
        updateAction: async () => ({ status: "success" }),
        deleteAction,
        moveAction,
      },
    });
    const region = screen.getByRole("region", { name: "통계 그룹 관리" });

    await user.click(within(region).getByRole("button", { name: "고정지출 수정" }));
    expect(within(region).getByLabelText("그룹 이름")).toHaveValue("고정지출");
    expect(within(region).getByLabelText("주거비")).toBeChecked();
    await user.click(within(region).getByRole("button", { name: "편집 취소" }));

    await user.click(within(region).getByRole("button", { name: "고정지출 아래로 이동" }));
    await waitFor(() => expect(moveAction).toHaveBeenCalledWith(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "down",
      "expense",
      [
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ],
    ));

    const deleteButton = within(region).getByRole("button", { name: "고정지출 삭제" });
    await waitFor(() => expect(deleteButton).toBeEnabled());
    await user.click(deleteButton);
    expect(confirm).toHaveBeenCalledWith("고정지출 그룹을 삭제할까요? 상세 분류와 거래는 유지됩니다.");
    await waitFor(() => expect(deleteAction).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
  });

  it("keeps income and expense groups on separate tabs", async () => {
    const user = userEvent.setup();
    renderScreen();
    const region = screen.getByRole("region", { name: "통계 그룹 관리" });

    await user.click(within(region).getByRole("button", { name: "수입 그룹" }));

    expect(within(region).getByText("그룹 미지정: 급여")).toBeVisible();
    expect(within(region).queryByText("고정지출")).not.toBeInTheDocument();
    await user.click(within(region).getByRole("button", { name: "통계 그룹 추가" }));
    expect(within(region).getByLabelText("급여")).toBeVisible();
    expect(within(region).queryByLabelText("식비")).not.toBeInTheDocument();
  });

  it("keeps a failed inline form open and closes it after a successful save", async () => {
    const user = userEvent.setup();
    const createAction = vi
      .fn()
      .mockResolvedValueOnce({ status: "error", message: "같은 이름의 통계 그룹이 있어요." })
      .mockResolvedValueOnce({ status: "success", message: "통계 그룹을 추가했어요." });
    renderScreen({
      statisticsGroupActions: {
        createAction,
        updateAction: async () => ({ status: "success" }),
        deleteAction: successChangeAction,
        moveAction: successChangeAction,
      },
    });
    const region = screen.getByRole("region", { name: "통계 그룹 관리" });

    await user.click(within(region).getByRole("button", { name: "통계 그룹 추가" }));
    await user.type(within(region).getByLabelText("그룹 이름"), "고정지출");
    await user.click(within(region).getByRole("button", { name: "그룹 저장" }));
    expect(await within(region).findByRole("alert")).toHaveTextContent("같은 이름의 통계 그룹이 있어요.");
    expect(within(region).getByLabelText("그룹 이름")).toHaveValue("고정지출");

    await user.click(within(region).getByRole("button", { name: "그룹 저장" }));
    await waitFor(() => expect(within(region).queryByLabelText("그룹 이름")).not.toBeInTheDocument());
  });

  it("shows group membership to members without owner controls", () => {
    renderScreen({ data: { ...data, isOwner: false } });
    const region = screen.getByRole("region", { name: "통계 그룹 관리" });

    expect(within(region).getByText("고정지출")).toBeVisible();
    expect(within(region).getByText(/주거비/)).toBeVisible();
    expect(within(region).queryByRole("button", { name: "통계 그룹 추가" })).not.toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: "고정지출 수정" })).not.toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: "고정지출 삭제" })).not.toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: "고정지출 아래로 이동" })).not.toBeInTheDocument();
  });

  it("shows only the migration notice when statistics group schema is unavailable", () => {
    renderScreen({
      data: { ...data, statisticsGroups: [], statisticsGroupsAvailable: false },
    });
    const region = screen.getByRole("region", { name: "통계 그룹 관리" });

    expect(region).toHaveTextContent("Supabase 통계 그룹 설정을 먼저 적용해 주세요.");
    expect(within(region).queryByText("고정지출")).not.toBeInTheDocument();
    expect(within(region).queryByRole("button")).not.toBeInTheDocument();
  });
});

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TrashPage from "@/app/(app)/settings/trash/page";
import { TrashScreen } from "@/features/trash/trash-screen";
import type { TrashActionState, TrashItem, TrashPage as TrashPageData } from "@/features/trash/types";

const navigation = vi.hoisted(() => ({ push: vi.fn(), redirect: vi.fn(), refresh: vi.fn() }));
const queryMocks = vi.hoisted(() => {
  class TrashAuthenticationError extends Error {}
  class TrashAuthorizationError extends Error {}
  class TrashUnavailableError extends Error {}
  class TrashQueryError extends Error {}
  return {
    getCurrentAppContext: vi.fn(),
    getTrashPageForCurrentUser: vi.fn(),
    TrashAuthenticationError,
    TrashAuthorizationError,
    TrashUnavailableError,
    TrashQueryError,
  };
});

vi.mock("next/navigation", () => ({
  redirect: navigation.redirect,
  useRouter: () => ({ push: navigation.push, refresh: navigation.refresh }),
}));

vi.mock("@/features/ledgers/queries", () => ({
  getCurrentAppContext: queryMocks.getCurrentAppContext,
}));

vi.mock("@/features/trash/queries", () => queryMocks);

vi.mock("@/features/trash/actions", () => ({
  permanentlyDeleteTransactionAction: vi.fn(),
  restoreDeletedTransactionAction: vi.fn(),
}));

const firstItem: TrashItem = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "expense",
  occurredOn: "2026-08-25",
  description: "팀 점심",
  amount: 46500,
  memo: "프로젝트 회의",
  category: { name: "식비", color: "#F97316" },
  createdBy: { id: "user-1", name: "권혁" },
  deletedAt: "2026-08-30T03:15:00.000Z",
};

const initialPage: TrashPageData = { items: [firstItem], nextCursor: null };
const successAction = async (): Promise<TrashActionState> => ({ status: "success", message: "처리했어요." });

let observerCallback: IntersectionObserverCallback | null = null;

class FakeIntersectionObserver {
  private callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    observerCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {
    if (observerCallback === this.callback) observerCallback = null;
  }
  root = null;
  rootMargin = "0px";
  thresholds = [0];
  takeRecords() { return []; }
}

function renderScreen(overrides: Partial<React.ComponentProps<typeof TrashScreen>> = {}) {
  return render(
    <TrashScreen
      initialPage={initialPage}
      ledgerName="우리 집"
      permanentlyDeleteAction={successAction}
      restoreAction={successAction}
      {...overrides}
    />,
  );
}

async function enterSentinel() {
  await act(async () => {
    observerCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

describe("TrashScreen", () => {
  beforeEach(() => {
    observerCallback = null;
    navigation.push.mockReset();
    navigation.refresh.mockReset();
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the same transaction details in mobile cards and the desktop table", () => {
    const view = renderScreen();

    expect(screen.getByRole("heading", { name: "우리 집 휴지통" })).toBeVisible();
    for (const text of ["팀 점심", "프로젝트 회의", "식비", "지출", "-46,500원", "권혁", "2026. 8. 30. 12:15"]) {
      expect(screen.getAllByText(text)).toHaveLength(2);
    }
    expect(view.container.querySelector("section.md\\:hidden")).toBeInTheDocument();
    expect(view.container.querySelector("table.hidden.md\\:table")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "휴지통 내역" })).toBeInTheDocument();
  });

  it("shows an empty state with a ledger link", () => {
    renderScreen({ initialPage: { items: [], nextCursor: null } });
    expect(screen.getByRole("heading", { name: "휴지통이 비어 있어요" })).toBeVisible();
    expect(screen.getByRole("link", { name: "가계부로 돌아가기" })).toHaveAttribute("href", "/ledger");
  });

  it("confirms restoration and removes a restored item", async () => {
    const user = userEvent.setup();
    const restoreAction = vi.fn(successAction);
    renderScreen({ restoreAction });

    await user.click(screen.getAllByRole("button", { name: "팀 점심 복원" })[0]);

    expect(confirm).toHaveBeenCalledWith("이 내역을 복원할까요?");
    expect(restoreAction).toHaveBeenCalledWith(firstItem.id);
    await waitFor(() => expect(screen.queryByText("팀 점심")).not.toBeInTheDocument());
  });

  it("cancels permanent deletion after the irreversible warning", async () => {
    const user = userEvent.setup();
    const permanentlyDeleteAction = vi.fn(successAction);
    vi.mocked(confirm).mockReturnValue(false);
    renderScreen({ permanentlyDeleteAction });

    await user.click(screen.getAllByRole("button", { name: "팀 점심 영구 삭제" })[0]);

    expect(confirm).toHaveBeenCalledWith("이 내역은 복구할 수 없습니다. 영구 삭제할까요?");
    expect(permanentlyDeleteAction).not.toHaveBeenCalled();
    expect(screen.getAllByText("팀 점심")).toHaveLength(2);
  });

  it("removes a permanently deleted item", async () => {
    const user = userEvent.setup();
    const permanentlyDeleteAction = vi.fn(successAction);
    renderScreen({ permanentlyDeleteAction });

    await user.click(screen.getAllByRole("button", { name: "팀 점심 영구 삭제" })[0]);

    expect(permanentlyDeleteAction).toHaveBeenCalledWith(firstItem.id);
    await waitFor(() => expect(screen.queryByText("팀 점심")).not.toBeInTheDocument());
  });

  it("keeps a failed item and displays its safe action error", async () => {
    const user = userEvent.setup();
    renderScreen({ restoreAction: async () => ({ status: "error", message: "이 내역을 변경할 수 없습니다." }) });

    await user.click(screen.getAllByRole("button", { name: "팀 점심 복원" })[0]);

    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("이 내역을 변경할 수 없습니다.");
    expect(screen.getAllByText("팀 점심")).toHaveLength(2);
  });

  it("uses a safe message when an action rejects", async () => {
    const user = userEvent.setup();
    renderScreen({ restoreAction: async () => { throw new Error("database details"); } });

    await user.click(screen.getAllByRole("button", { name: "팀 점심 복원" })[0]);

    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent("복원하지 못했습니다. 다시 시도해 주세요.");
    expect(screen.queryByText("database details")).not.toBeInTheDocument();
  });

  it.each([
    ["복원", "restoreAction"],
    ["영구 삭제", "permanentlyDeleteAction"],
  ] as const)("takes an expired %s mutation session to login", async (label, actionName) => {
    const user = userEvent.setup();
    const expiredAction = async () => ({
      status: "unauthenticated",
      message: "로그인이 필요합니다.",
    } as unknown as TrashActionState);
    renderScreen({ [actionName]: expiredAction });

    await user.click(screen.getAllByRole("button", { name: `팀 점심 ${label}` })[0]);

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith("/login?next=%2Fsettings%2Ftrash");
    });
    expect(screen.getAllByText("팀 점심")).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("locks both actions for an item while it is pending", async () => {
    const user = userEvent.setup();
    let finish!: (state: TrashActionState) => void;
    const pending = new Promise<TrashActionState>((resolve) => { finish = resolve; });
    renderScreen({ restoreAction: () => pending });

    await user.click(screen.getAllByRole("button", { name: "팀 점심 복원" })[0]);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /팀 점심 (복원|영구 삭제)/ })).toHaveLength(4);
      for (const button of screen.getAllByRole("button", { name: /팀 점심 (복원|영구 삭제)/ })) {
        expect(button).toBeDisabled();
      }
    });
    await act(async () => finish({ status: "error", message: "다시 시도해 주세요." }));
  });

  it("loads each cursor once, removes duplicate IDs, and stops at the last page", async () => {
    let finish!: (page: TrashPageData) => void;
    const pending = new Promise<TrashPageData>((resolve) => { finish = resolve; });
    const loadPage = vi.fn(() => pending);
    renderScreen({ initialPage: { ...initialPage, nextCursor: "cursor-1" }, loadPage });

    await act(async () => {
      const entries = [{ isIntersecting: true } as IntersectionObserverEntry];
      observerCallback?.(entries, {} as IntersectionObserver);
      observerCallback?.(entries, {} as IntersectionObserver);
    });

    expect(loadPage).toHaveBeenCalledTimes(1);
    expect(loadPage).toHaveBeenCalledWith("cursor-1");
    expect(screen.getByText("휴지통 내역을 불러오는 중...")).toBeVisible();

    const secondItem = { ...firstItem, id: "22222222-2222-4222-8222-222222222222", description: "저녁 식사" };
    await act(async () => finish({ items: [firstItem, secondItem, secondItem], nextCursor: null }));

    await waitFor(() => expect(screen.getAllByText("저녁 식사")).toHaveLength(2));
    expect(screen.getAllByText("팀 점심")).toHaveLength(2);
    expect(screen.queryByText("모든 내역을 확인했어요")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trash-sentinel")).not.toBeInTheDocument();
    await enterSentinel();
    expect(loadPage).toHaveBeenCalledTimes(1);
  });

  it("keeps loaded items and offers retry after a page error", async () => {
    const loadPage = vi.fn().mockRejectedValue(new Error("network detail"));
    renderScreen({ initialPage: { ...initialPage, nextCursor: "cursor-1" }, loadPage });

    await enterSentinel();

    expect(await screen.findByRole("alert")).toHaveTextContent("추가 휴지통 내역을 불러오지 못했습니다.");
    expect(screen.getAllByText("팀 점심")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeVisible();
    expect(screen.queryByText("network detail")).not.toBeInTheDocument();
  });

  it("hides existing items and shows a settings link when access is revoked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: "휴지통을 볼 권한이 없습니다." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )));
    renderScreen({ initialPage: { ...initialPage, nextCursor: "cursor-1" } });

    await enterSentinel();

    expect(await screen.findByRole("heading", { name: "장부 소유자만 휴지통을 볼 수 있어요" })).toBeVisible();
    expect(screen.queryByText("팀 점심")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "설정으로 돌아가기" })).toHaveAttribute("href", "/settings");
  });

  it("stops pagination after the session expires while the sentinel stays visible", async () => {
    const fetchPage = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchPage);
    renderScreen({ initialPage: { ...initialPage, nextCursor: "cursor-1" } });

    await enterSentinel();
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/login?next=%2Fsettings%2Ftrash"));

    await enterSentinel();

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(navigation.push).toHaveBeenCalledTimes(1);
  });

  it("refreshes once when the tab becomes visible and removes its single listener", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const addEventListener = vi.spyOn(document, "addEventListener");
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    const view = renderScreen();

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(navigation.refresh).not.toHaveBeenCalled();

    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(navigation.refresh).toHaveBeenCalledOnce();
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(navigation.refresh).toHaveBeenCalledOnce();

    view.rerender(
      <TrashScreen
        initialPage={initialPage}
        ledgerName="우리 집"
        permanentlyDeleteAction={successAction}
        restoreAction={successAction}
      />,
    );
    expect(addEventListener.mock.calls.filter(([event]) => event === "visibilitychange")).toHaveLength(1);

    view.unmount();
    expect(removeEventListener.mock.calls.filter(([event]) => event === "visibilitychange")).toHaveLength(1);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(navigation.refresh).toHaveBeenCalledOnce();
  });
});

describe("TrashPage", () => {
  beforeEach(() => {
    queryMocks.getCurrentAppContext.mockReset();
    queryMocks.getTrashPageForCurrentUser.mockReset();
    queryMocks.getCurrentAppContext.mockResolvedValue({
      currentLedger: { id: "ledger-1", name: "우리 집", kind: "personal", role: "owner" },
      ledgers: [],
      needsDefaultRepair: false,
      pendingInvitationCount: 0,
      userId: "user-1",
      userName: "권혁",
    });
  });

  afterEach(cleanup);

  it("shows an owner-only notice without leaking items to a member", async () => {
    queryMocks.getTrashPageForCurrentUser.mockRejectedValue(new queryMocks.TrashAuthorizationError());

    render(await TrashPage());

    expect(screen.getByRole("heading", { name: "장부 소유자만 휴지통을 볼 수 있어요" })).toBeVisible();
    expect(screen.getByRole("link", { name: "설정으로 돌아가기" })).toHaveAttribute("href", "/settings");
  });

  it("shows a deployment-safe notice while the trash schema is unavailable", async () => {
    queryMocks.getTrashPageForCurrentUser.mockRejectedValue(new queryMocks.TrashUnavailableError());

    render(await TrashPage());

    expect(screen.getByRole("heading", { name: "휴지통 준비가 아직 끝나지 않았어요" })).toBeVisible();
  });
});

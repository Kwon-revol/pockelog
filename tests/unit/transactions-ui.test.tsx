import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LedgerScreen } from "@/features/transactions/ledger-screen";
import type {
  LedgerPageData,
  TransactionActionState,
  TransactionPage,
} from "@/features/transactions/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fixture: LedgerPageData = {
  ledger: { id: "ledger-1", name: "내 장부", periodStartDay: 1, kind: "personal" },
  categories: [
    { id: "11111111-1111-4111-8111-111111111111", name: "식비", color: "#F97316", type: "expense", systemCode: null },
    { id: "22222222-2222-4222-8222-222222222222", name: "급여", color: "#10B981", type: "income", systemCode: null },
  ],
  filters: {
    startOn: "2026-08-01",
    endOn: "2026-08-31",
    endExclusive: "2026-09-01",
    query: "",
    type: "all",
    categoryId: null,
    sort: "newest",
  },
  page: {
    items: [{
      id: "33333333-3333-4333-8333-333333333333",
      type: "expense",
      occurredOn: "2026-08-26",
      description: "점심",
      amount: 46500,
      memo: "",
      createdBy: { id: "user-1", name: "권혁" },
      canManage: true,
      category: { id: "11111111-1111-4111-8111-111111111111", name: "식비", color: "#F97316", type: "expense", systemCode: null },
      createdAt: "2026-08-26T01:00:00.000Z",
    }],
    nextCursor: null,
  },
  summary: { incomeTotal: 2800000, expenseTotal: 46500, balance: 2753500 },
  initialEditorItem: null,
  initialCategoryId: null,
};

const successAction = async (): Promise<TransactionActionState> => ({ status: "success" });

let observerCallback: IntersectionObserverCallback | null = null;

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  root = null;
  rootMargin = "0px";
  thresholds = [0];
  takeRecords() { return []; }
}

describe("LedgerScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows formatted totals and opens the add panel", async () => {
    const user = userEvent.setup();
    render(
      <LedgerScreen
        initialData={fixture}
        createAction={successAction}
        updateAction={async () => ({ status: "success" })}
        trashAction={async () => ({ status: "success" })}
      />,
    );

    expect(screen.getByTestId("expense-total")).toHaveTextContent("46,500원");
    expect(screen.getByTestId("balance-total")).toHaveTextContent("2,753,500원");
    expect(screen.queryByText("권혁 작성")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /점심/ })).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "내역 추가" })[0]);
    expect(screen.getByRole("dialog", { name: "내역 추가" })).toBeVisible();
  });

  it("opens a new expense form with the requested pension category selected", () => {
    const pensionCategoryId = "99999999-9999-4999-8999-999999999999";
    const presetFixture = {
      ...fixture,
      categories: [{
        id: pensionCategoryId,
        name: "내가 바꾼 연금저축 이름",
        color: "#10B981",
        type: "expense" as const,
        systemCode: "pension_savings" as const,
      }],
      initialCategoryId: pensionCategoryId,
    } as unknown as LedgerPageData;
    render(
      <LedgerScreen initialData={presetFixture} createAction={successAction} updateAction={successAction} trashAction={successAction} />,
    );

    const dialog = screen.getByRole("dialog", { name: "내역 추가" });
    expect(within(dialog).getByRole("radio", { name: "지출" })).toBeChecked();
    expect(within(dialog).getByLabelText("분류")).toHaveValue(pensionCategoryId);
  });

  it("submits the pension preset marker with a preset create", async () => {
    const user = userEvent.setup();
    const pensionCategoryId = "99999999-9999-4999-8999-999999999999";
    let submitted: FormData | null = null;
    const presetFixture = {
      ...fixture,
      categories: [{
        id: pensionCategoryId,
        name: "연금저축",
        color: "#10B981",
        type: "expense" as const,
        systemCode: "pension_savings" as const,
      }],
      initialCategoryId: pensionCategoryId,
    } as LedgerPageData;
    render(
      <LedgerScreen
        initialData={presetFixture}
        createAction={async (_state, formData) => {
          submitted = formData;
          return { status: "error", message: "저장 실패" };
        }}
        updateAction={successAction}
        trashAction={successAction}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "내역 추가" });
    await user.type(within(dialog).getByLabelText("내용"), "8월 연금저축");
    await user.type(within(dialog).getByRole("textbox", { name: /금액/ }), "500000");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(submitted?.get("pensionContributionPreset")).toBe("1"));
  });

  it("does not open a form without a recognized new preset", () => {
    render(
      <LedgerScreen initialData={fixture} createAction={successAction} updateAction={successAction} trashAction={successAction} />,
    );

    expect(screen.queryByRole("dialog", { name: "내역 추가" })).not.toBeInTheDocument();
  });

  it("resets the category when the transaction type changes", async () => {
    const user = userEvent.setup();
    render(
      <LedgerScreen initialData={fixture} createAction={successAction} updateAction={successAction} trashAction={successAction} />,
    );
    await user.click(screen.getAllByRole("button", { name: "내역 추가" })[0]);
    const dialog = screen.getByRole("dialog", { name: "내역 추가" });
    const category = within(dialog).getByLabelText("분류") as HTMLSelectElement;
    await user.selectOptions(category, "11111111-1111-4111-8111-111111111111");
    await user.click(screen.getByRole("radio", { name: "수입" }));
    expect(category.value).toBe("");
    expect(within(dialog).queryByRole("option", { name: "식비" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "급여" })).toBeInTheDocument();
  });

  it("loads the next page once when the sentinel enters view", async () => {
    const nextItem = { ...fixture.page.items[0], id: "44444444-4444-4444-8444-444444444444", description: "저녁" };
    const loadPage = vi.fn<() => Promise<TransactionPage>>().mockResolvedValue({ items: [nextItem], nextCursor: null });
    render(
      <LedgerScreen
        initialData={{ ...fixture, page: { ...fixture.page, nextCursor: "cursor-1" } }}
        createAction={successAction}
        updateAction={successAction}
        trashAction={successAction}
        loadPage={loadPage}
      />,
    );

    await act(async () => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    await waitFor(() => expect(loadPage).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText("저녁").length).toBeGreaterThan(0);
    expect(screen.queryByText("모든 내역을 확인했어요")).not.toBeInTheDocument();
  });

  it("keeps an inactive current category available while editing", async () => {
    const user = userEvent.setup();
    const inactiveCategory = {
      id: "55555555-5555-4555-8555-555555555555",
      name: "예전 식비",
      color: "#64748B",
      type: "expense" as const,
      systemCode: null,
    };
    const inactiveItem = { ...fixture.page.items[0], category: inactiveCategory };
    render(
      <LedgerScreen
        initialData={{ ...fixture, page: { items: [inactiveItem], nextCursor: null } }}
        createAction={successAction}
        updateAction={successAction}
        trashAction={successAction}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /점심/ })[0]);
    const dialog = screen.getByRole("dialog", { name: "내역 수정" });
    expect(within(dialog).getByRole("option", { name: "예전 식비" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("분류")).toHaveValue(inactiveCategory.id);
  });

  it("opens the existing editor with the item loaded from an edit query", () => {
    const initialEditorItem = {
      ...fixture.page.items[0],
      description: "세금 화면 연금저축",
      amount: 500000,
      memo: "자동 편집 연결",
    };
    render(
      <LedgerScreen
        initialData={{ ...fixture, initialEditorItem }}
        createAction={successAction}
        updateAction={successAction}
        trashAction={successAction}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "내역 수정" });
    expect(within(dialog).getByLabelText("내용")).toHaveValue("세금 화면 연금저축");
    expect(within(dialog).getByRole("textbox", { name: /금액/ })).toHaveValue("500000");
    expect(within(dialog).getByLabelText(/메모/)).toHaveValue("자동 편집 연결");
  });

  it("does not start the same cursor request twice before state rerenders", async () => {
    let resolvePage!: (page: TransactionPage) => void;
    const pendingPage = new Promise<TransactionPage>((resolve) => { resolvePage = resolve; });
    const loadPage = vi.fn(() => pendingPage);
    render(
      <LedgerScreen
        initialData={{ ...fixture, page: { ...fixture.page, nextCursor: "cursor-1" } }}
        createAction={successAction}
        updateAction={successAction}
        trashAction={successAction}
        loadPage={loadPage}
      />,
    );

    await act(async () => {
      const entry = [{ isIntersecting: true } as IntersectionObserverEntry];
      observerCallback?.(entry, {} as IntersectionObserver);
      observerCallback?.(entry, {} as IntersectionObserver);
    });
    expect(loadPage).toHaveBeenCalledTimes(1);
    await act(async () => resolvePage({ items: [], nextCursor: null }));
  });

  it("keeps the edit panel open and shows a trash failure", async () => {
    const user = userEvent.setup();
    render(
      <LedgerScreen
        initialData={fixture}
        createAction={successAction}
        updateAction={successAction}
        trashAction={async () => ({ status: "error", message: "이 내역을 변경할 수 없습니다." })}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /점심/ })[0]);
    const dialog = screen.getByRole("dialog", { name: "내역 수정" });
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("이 내역을 변경할 수 없습니다.");
    expect(dialog).toBeVisible();
  });

  it("keeps the edit panel open when the trash request is rejected", async () => {
    const user = userEvent.setup();
    render(
      <LedgerScreen
        initialData={fixture}
        createAction={successAction}
        updateAction={successAction}
        trashAction={async () => { throw new Error("network down"); }}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /점심/ })[0]);
    const dialog = screen.getByRole("dialog", { name: "내역 수정" });
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("휴지통으로 이동하지 못했습니다. 다시 시도해 주세요.");
    expect(dialog).toBeVisible();
  });

  it("shows the creator and does not open another member's transaction", async () => {
    const user = userEvent.setup();
    const otherMemberItem = {
      ...fixture.page.items[0],
      createdBy: { id: "user-2", name: "민지" },
      canManage: false,
    };
    render(
      <LedgerScreen
        initialData={{ ...fixture, ledger: { ...fixture.ledger, kind: "shared" }, page: { items: [otherMemberItem], nextCursor: null } }}
        createAction={successAction}
        updateAction={successAction}
        trashAction={successAction}
      />,
    );

    expect(screen.getAllByText("민지 작성").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /점심/ })).not.toBeInTheDocument();
    await user.click(screen.getAllByText("점심")[0]);
    expect(screen.queryByRole("dialog", { name: "내역 수정" })).not.toBeInTheDocument();
  });
});

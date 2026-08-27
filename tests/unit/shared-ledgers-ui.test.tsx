import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SharedLedgerManager,
  type SharedLedgerManagerActions,
} from "@/features/shared-ledgers/shared-ledger-manager";
import type { SharedLedgerPageData } from "@/features/shared-ledgers/types";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const ownerId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const sharedId = "33333333-3333-4333-8333-333333333333";
const invitationId = "44444444-4444-4444-8444-444444444444";

const data: SharedLedgerPageData = {
  currentLedger: { id: sharedId, name: "우리 집", kind: "shared", role: "owner", isCurrent: true },
  ledgers: [
    { id: "55555555-5555-4555-8555-555555555555", name: "내 장부", kind: "personal", role: "owner", isCurrent: false },
    { id: sharedId, name: "우리 집", kind: "shared", role: "owner", isCurrent: true },
  ],
  receivedInvitations: [{
    id: invitationId,
    ledgerId: "66666666-6666-4666-8666-666666666666",
    ledgerName: "여행 장부",
    targetUserId: ownerId,
    targetName: "권혁",
    invitedByName: "초대한 사람",
    status: "pending",
    expiresAt: "2026-09-01T00:00:00Z",
    createdAt: "2026-08-27T00:00:00Z",
  }],
  sentInvitations: [{
    id: "77777777-7777-4777-8777-777777777777",
    ledgerId: sharedId,
    ledgerName: "우리 집",
    targetUserId: memberId,
    targetName: "초대 대상",
    invitedByName: "권혁",
    status: "pending",
    expiresAt: "2026-09-01T00:00:00Z",
    createdAt: "2026-08-27T00:00:00Z",
  }],
  members: [
    { userId: ownerId, displayName: "권혁", role: "owner", joinedAt: "2026-08-01T00:00:00Z" },
    { userId: memberId, displayName: "참여자", role: "member", joinedAt: "2026-08-02T00:00:00Z" },
  ],
};

const success = async () => ({ status: "success" as const, message: "변경했어요." });
const actions: SharedLedgerManagerActions = {
  createAction: success,
  inviteAction: success,
  respondAction: success,
  revokeAction: success,
  removeAction: success,
  leaveAction: success,
  deleteAction: success,
};

describe("SharedLedgerManager", () => {
  beforeEach(() => {
    navigation.push.mockReset();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows received invitations and lets the target accept or decline", async () => {
    const user = userEvent.setup();
    const respondAction = vi.fn(success);
    render(<SharedLedgerManager actions={{ ...actions, respondAction }} data={data} />);

    expect(screen.getByText("여행 장부")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "여행 장부 초대 수락" }));
    expect(respondAction).toHaveBeenCalledWith(invitationId, "accept");
    expect(screen.getByRole("button", { name: "여행 장부 초대 거절" })).toBeVisible();
  });

  it("shows invitation and member controls only to the shared ledger owner", () => {
    render(<SharedLedgerManager actions={actions} data={data} />);

    expect(screen.getByRole("button", { name: "공동 장부 만들기" })).toBeVisible();
    expect(screen.getByLabelText("초대할 아이디 또는 이메일")).toBeVisible();
    expect(screen.getByRole("button", { name: "참여자 제거" })).toBeVisible();
    expect(screen.getByRole("button", { name: "초대 대상 초대 취소" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "이 장부 나가기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "공동 장부 삭제" })).toBeInTheDocument();
  });

  it("lets a member leave but hides owner-only controls", () => {
    render(<SharedLedgerManager actions={actions} data={{
      ...data,
      currentLedger: { ...data.currentLedger, role: "member" },
      sentInvitations: [],
    }} />);

    expect(screen.getByRole("button", { name: "이 장부 나가기" })).toBeVisible();
    expect(screen.queryByLabelText("초대할 아이디 또는 이메일")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "참여자 제거" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "공동 장부 삭제" })).not.toBeInTheDocument();
  });

  it("moves to the ledger after leaving or deleting a shared ledger", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SharedLedgerManager actions={actions} data={{
      ...data,
      currentLedger: { ...data.currentLedger, role: "member" },
      sentInvitations: [],
    }} />);

    await user.click(screen.getByRole("button", { name: "이 장부 나가기" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/ledger"));
    unmount();
    navigation.push.mockReset();

    render(<SharedLedgerManager actions={actions} data={data} />);
    await user.click(screen.getAllByText("공동 장부 삭제")[0]);
    await user.type(screen.getByLabelText("삭제 확인 장부 이름"), "우리 집");
    await user.click(screen.getByRole("button", { name: "공동 장부 삭제" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/ledger"));
  });

  it("hides membership destruction controls for a personal ledger", () => {
    render(<SharedLedgerManager actions={actions} data={{
      ...data,
      currentLedger: { ...data.ledgers[0], isCurrent: true },
      sentInvitations: [],
      members: [data.members[0]],
    }} />);

    expect(screen.queryByRole("button", { name: "이 장부 나가기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "공동 장부 삭제" })).not.toBeInTheDocument();
  });
});

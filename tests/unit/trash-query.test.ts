import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

import { decodeTrashCursor, encodeTrashCursor } from "@/features/trash/cursor";
import {
  getTrashPageForCurrentUser,
  TrashAuthenticationError,
  TrashAuthorizationError,
  TrashQueryError,
  TrashUnavailableError,
} from "@/features/trash/queries";

const userId = "11111111-1111-4111-8111-111111111111";
const ledgerId = "22222222-2222-4222-8222-222222222222";

function deletedRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000000`,
    type: index % 2 === 0 ? "expense" as const : "income" as const,
    occurred_on: "2026-08-26",
    description: `삭제 내역 ${index + 1}`,
    amount: String(1_000 + index),
    memo: index === 0 ? "메모" : "",
    category_name: "식비",
    category_color: "#F97316",
    created_by: userId,
    creator_name: "권혁",
    deleted_at: `2026-08-31T00:00:${String(index).padStart(2, "0")}.000Z`,
  }));
}

function serverClient({
  user = { id: userId },
  profile = { data: { default_ledger_id: ledgerId }, error: null },
  rpcResult = { data: deletedRows(51), error: null },
}: {
  user?: { id: string } | null;
  profile?: { data: { default_ledger_id: string } | null; error: { code?: string; message?: string } | null };
  rpcResult?: { data: ReturnType<typeof deletedRows> | null; error: { code?: string; message?: string } | null };
} = {}) {
  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(profile),
  };
  profileQuery.select.mockReturnValue(profileQuery);
  profileQuery.eq.mockReturnValue(profileQuery);
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const from = vi.fn(() => profileQuery);
  const getUser = vi.fn().mockResolvedValue({ data: { user } });
  return {
    client: { auth: { getUser }, from, rpc },
    spies: { getUser, from, profileQuery, rpc },
  };
}

describe("trash server query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps 51 RPC rows to 50 items and cursors from the fiftieth visible item", async () => {
    const fake = serverClient();
    mocks.createServerClient.mockResolvedValue(fake.client);

    const page = await getTrashPageForCurrentUser();

    expect(page.items).toHaveLength(50);
    expect(page.items[0]).toEqual({
      id: "00000001-0000-4000-8000-000000000000",
      type: "expense",
      occurredOn: "2026-08-26",
      description: "삭제 내역 1",
      amount: 1_000,
      memo: "메모",
      category: { name: "식비", color: "#F97316" },
      createdBy: { id: userId, name: "권혁" },
      deletedAt: "2026-08-31T00:00:00.000Z",
    });
    expect(page.items.at(-1)?.description).toBe("삭제 내역 50");
    expect(decodeTrashCursor(page.nextCursor ?? "")).toEqual({
      deletedAt: "2026-08-31T00:00:49.000Z",
      id: "00000050-0000-4000-8000-000000000000",
    });
    expect(fake.spies.from).toHaveBeenCalledWith("user_private_profiles");
    expect(fake.spies.profileQuery.eq).toHaveBeenCalledWith("user_id", userId);
    expect(fake.spies.rpc).toHaveBeenCalledWith("get_deleted_transactions", {
      target_ledger_id: ledgerId,
      cursor_deleted_at: null,
      cursor_id: null,
      page_size: 50,
    });
  });

  it("passes a decoded tuple cursor and omits nextCursor at 50 rows", async () => {
    const cursor = {
      deletedAt: "2026-08-30T01:02:03.000Z",
      id: "33333333-3333-4333-8333-333333333333",
    };
    const fake = serverClient({ rpcResult: { data: deletedRows(50), error: null } });
    mocks.createServerClient.mockResolvedValue(fake.client);

    const page = await getTrashPageForCurrentUser(encodeTrashCursor(cursor));

    expect(page.nextCursor).toBeNull();
    expect(fake.spies.rpc).toHaveBeenCalledWith("get_deleted_transactions", {
      target_ledger_id: ledgerId,
      cursor_deleted_at: cursor.deletedAt,
      cursor_id: cursor.id,
      page_size: 50,
    });
  });

  it("rejects a signed-out session before reading private profile data", async () => {
    const fake = serverClient({ user: null });
    mocks.createServerClient.mockResolvedValue(fake.client);

    await expect(getTrashPageForCurrentUser()).rejects.toBeInstanceOf(TrashAuthenticationError);
    expect(fake.spies.from).not.toHaveBeenCalled();
    expect(fake.spies.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", TrashAuthorizationError],
    ["42883", TrashUnavailableError],
    ["PGRST202", TrashUnavailableError],
    ["XX000", TrashQueryError],
  ] as const)("maps database code %s to its public query error", async (code, ErrorType) => {
    const fake = serverClient({
      rpcResult: { data: null, error: { code, message: "secret database detail" } },
    });
    mocks.createServerClient.mockResolvedValue(fake.client);

    const error = await getTrashPageForCurrentUser().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ErrorType);
    expect((error as Error).message).not.toContain("secret database detail");
  });
});

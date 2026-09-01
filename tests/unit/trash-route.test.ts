import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TrashAuthenticationError extends Error {}
  class TrashAuthorizationError extends Error {}
  class TrashUnavailableError extends Error {}
  class TrashQueryError extends Error {}
  return {
    getTrashPageForCurrentUser: vi.fn(),
    TrashAuthenticationError,
    TrashAuthorizationError,
    TrashUnavailableError,
    TrashQueryError,
  };
});

vi.mock("@/features/trash/queries", () => ({
  getTrashPageForCurrentUser: mocks.getTrashPageForCurrentUser,
  TrashAuthenticationError: mocks.TrashAuthenticationError,
  TrashAuthorizationError: mocks.TrashAuthorizationError,
  TrashUnavailableError: mocks.TrashUnavailableError,
  TrashQueryError: mocks.TrashQueryError,
}));

import { GET } from "@/app/api/trash/route";
import { encodeTrashCursor } from "@/features/trash/cursor";

function request(query = "") {
  return { nextUrl: new URL(`http://localhost/api/trash${query ? `?${query}` : ""}`) } as Parameters<typeof GET>[0];
}

describe("trash page route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getTrashPageForCurrentUser.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("returns 400 for a malformed cursor without querying", async () => {
    const response = await GET(request("cursor=broken"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "잘못된 조회 요청입니다." });
    expect(mocks.getTrashPageForCurrentUser).not.toHaveBeenCalled();
  });

  it("returns a trash page for a valid cursor", async () => {
    const cursor = encodeTrashCursor({
      deletedAt: "2026-08-31T01:02:03.000Z",
      id: "11111111-1111-4111-8111-111111111111",
    });
    const page = { items: [], nextCursor: null };
    mocks.getTrashPageForCurrentUser.mockResolvedValue(page);

    const response = await GET(request(`cursor=${cursor}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(page);
    expect(mocks.getTrashPageForCurrentUser).toHaveBeenCalledWith(cursor);
  });

  it.each([
    [new mocks.TrashAuthenticationError("secret"), 401, "로그인이 필요합니다."],
    [new mocks.TrashAuthorizationError("secret"), 403, "휴지통을 볼 권한이 없습니다."],
    [new mocks.TrashUnavailableError("secret"), 503, "휴지통 준비가 아직 끝나지 않았어요."],
    [new mocks.TrashQueryError("secret"), 500, "휴지통을 불러오지 못했습니다."],
  ] as const)("maps a query failure to HTTP %s without leaking details", async (error, status, message) => {
    mocks.getTrashPageForCurrentUser.mockRejectedValue(error);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body).toEqual({ message });
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});

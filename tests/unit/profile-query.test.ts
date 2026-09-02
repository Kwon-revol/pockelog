import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}));

import {
  getProfilePageData,
  ProfileQueryError,
} from "@/features/profile/queries";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function query<T>(result: QueryResult<T>) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

function serverClient({
  user = { id: userId, email: "owner@example.com" },
  profile = { data: { display_name: "포켓 사용자" }, error: null },
  privateProfile = { data: { phone_normalized: "01012345678" }, error: null },
}: {
  user?: { id: string; email?: string } | null;
  profile?: QueryResult<{ display_name: string }>;
  privateProfile?: QueryResult<{ phone_normalized: string }>;
} = {}) {
  const profileQuery = query(profile);
  const privateProfileQuery = query(privateProfile);
  const from = vi.fn((table: string) => {
    if (table === "profiles") return profileQuery;
    if (table === "user_private_profiles") return privateProfileQuery;
    throw new Error(`unexpected table: ${table}`);
  });
  const getUser = vi.fn().mockResolvedValue({ data: { user }, error: null });

  return {
    client: { auth: { getUser }, from },
    spies: { getUser, from, profileQuery, privateProfileQuery },
  };
}

describe("getProfilePageData", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
  });

  it("returns null before querying profile tables when the current session is absent", async () => {
    const fake = serverClient({ user: null });
    mocks.createServerClient.mockResolvedValue(fake.client);

    await expect(getProfilePageData()).resolves.toBeNull();
    expect(fake.spies.from).not.toHaveBeenCalled();
  });

  it("loads the public profile by its id and the private profile by user_id for the current user only", async () => {
    const fake = serverClient();
    mocks.createServerClient.mockResolvedValue(fake.client);

    await expect(getProfilePageData()).resolves.toEqual({
      displayName: "포켓 사용자",
      email: "owner@example.com",
      phone: "01012345678",
    });
    expect(fake.spies.from).toHaveBeenCalledWith("profiles");
    expect(fake.spies.from).toHaveBeenCalledWith("user_private_profiles");
    expect(fake.spies.profileQuery.select).toHaveBeenCalledWith("display_name");
    expect(fake.spies.privateProfileQuery.select).toHaveBeenCalledWith("phone_normalized");
    expect(fake.spies.profileQuery.eq).toHaveBeenCalledWith("id", userId);
    expect(fake.spies.privateProfileQuery.eq).toHaveBeenCalledWith("user_id", userId);
    expect(fake.spies.profileQuery.eq).not.toHaveBeenCalledWith("id", otherUserId);
    expect(fake.spies.privateProfileQuery.eq).not.toHaveBeenCalledWith("user_id", otherUserId);
  });

  it("rejects a current user without an email using a safe query error", async () => {
    const fake = serverClient({ user: { id: userId } });
    mocks.createServerClient.mockResolvedValue(fake.client);

    await expect(getProfilePageData()).rejects.toBeInstanceOf(ProfileQueryError);
    expect(fake.spies.from).not.toHaveBeenCalled();
  });

  it.each([
    ["public profile query error", { data: null, error: { message: "secret public error" } }, undefined],
    ["private profile query error", undefined, { data: null, error: { message: "secret private error" } }],
    ["missing public profile row", { data: null, error: null }, undefined],
    ["missing private profile row", undefined, { data: null, error: null }],
  ] as const)("maps %s to ProfileQueryError without leaking provider details", async (_name, profile, privateProfile) => {
    const fake = serverClient({
      ...(profile ? { profile } : {}),
      ...(privateProfile ? { privateProfile } : {}),
    });
    mocks.createServerClient.mockResolvedValue(fake.client);

    const error = await getProfilePageData().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProfileQueryError);
    expect((error as Error).message).not.toContain("secret");
  });
});

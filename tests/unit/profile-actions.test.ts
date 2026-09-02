import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseProfileGateway: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/profile/supabase-gateway", () => ({
  createSupabaseProfileGateway: mocks.createSupabaseProfileGateway,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  changePasswordAction,
  updateProfileAction,
} from "@/features/profile/actions";
import { initialProfileActionState } from "@/features/profile/types";

function profileFormData() {
  const formData = new FormData();
  formData.set("displayName", " 새 이름 ");
  formData.set("phone", "010-1234-5678");
  formData.set("email", "attacker@example.com");
  formData.set("userId", "22222222-2222-4222-8222-222222222222");
  return formData;
}

function passwordFormData() {
  const formData = new FormData();
  formData.set("currentPassword", "old-secret");
  formData.set("newPassword", "new-secret");
  formData.set("confirmPassword", "new-secret");
  return formData;
}

function redirectError() {
  const error = new Error("NEXT_REDIRECT");
  mocks.redirect.mockImplementation(() => {
    throw error;
  });
  return error;
}

describe("profile server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    [updateProfileAction, new FormData(), "displayName"],
    [changePasswordAction, new FormData(), "currentPassword"],
  ] as const)("returns field errors before creating a gateway", async (action, formData, field) => {
    const result = await action(initialProfileActionState, formData);

    expect(result).toMatchObject({ status: "error", message: "입력한 내용을 확인해 주세요." });
    expect(result.fieldErrors?.[field]).toBeDefined();
    expect(mocks.createSupabaseProfileGateway).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("passes only validated profile values and revalidates all four consumers on success", async () => {
    const updateProfile = vi.fn().mockResolvedValue("updated");
    mocks.createSupabaseProfileGateway.mockResolvedValue({
      updateProfile,
      changePassword: vi.fn(),
    });

    await expect(
      updateProfileAction(initialProfileActionState, profileFormData()),
    ).resolves.toEqual({ status: "success", message: "프로필을 저장했어요." });
    expect(updateProfile).toHaveBeenCalledWith({
      displayName: "새 이름",
      phone: "01012345678",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ledger");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/statistics");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/trash");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
  });

  it.each([
    [updateProfileAction, profileFormData(), "profile"],
    [changePasswordAction, passwordFormData(), "password"],
  ] as const)("redirects an expired session without swallowing redirect control flow", async (action, formData, mutation) => {
    const controlFlow = redirectError();
    const gateway = {
      updateProfile: vi.fn().mockResolvedValue(mutation === "profile" ? "unauthenticated" : "error"),
      changePassword: vi.fn().mockResolvedValue(mutation === "password" ? "unauthenticated" : "error"),
    };
    mocks.createSupabaseProfileGateway.mockResolvedValue(gateway);

    await expect(action(initialProfileActionState, formData)).rejects.toBe(controlFlow);
    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=%2Fsettings");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("redirects to the login completion notice after a password change", async () => {
    const controlFlow = redirectError();
    mocks.createSupabaseProfileGateway.mockResolvedValue({
      updateProfile: vi.fn(),
      changePassword: vi.fn().mockResolvedValue("changed"),
    });

    await expect(
      changePasswordAction(initialProfileActionState, passwordFormData()),
    ).rejects.toBe(controlFlow);
    expect(mocks.redirect).toHaveBeenCalledWith("/login?passwordChanged=1");
  });

  it.each([
    [updateProfileAction, profileFormData(), "프로필을 저장하지 못했습니다. 다시 시도해 주세요."],
    [changePasswordAction, passwordFormData(), "비밀번호를 변경하지 못했습니다. 다시 시도해 주세요."],
  ] as const)("maps gateway creation exceptions to safe action state", async (action, formData, message) => {
    mocks.createSupabaseProfileGateway.mockRejectedValue(new Error("secret provider setup"));

    await expect(action(initialProfileActionState, formData)).resolves.toEqual({
      status: "error",
      message,
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

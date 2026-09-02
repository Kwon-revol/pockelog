import { describe, expect, it } from "vitest";

import type { PasswordChangeInput, ProfileGateway, ProfileInput } from "@/features/profile/types";
import { changeOwnPassword, updateOwnProfile } from "@/features/profile/workflows";

const profileInput: ProfileInput = { displayName: "사용자 이름", phone: "01012345678" };
const passwordInput: PasswordChangeInput = {
  currentPassword: "old-password1!",
  newPassword: "new-password1!",
};

function gateway(overrides: Partial<ProfileGateway> = {}): ProfileGateway {
  return {
    async updateProfile() { return "updated"; },
    async changePassword() { return "changed"; },
    ...overrides,
  };
}

describe("profile workflows", () => {
  it("maps successful profile and password changes to success states", async () => {
    await expect(updateOwnProfile(profileInput, gateway())).resolves.toEqual({
      status: "success",
      message: "프로필을 저장했어요.",
    });
    await expect(changeOwnPassword(passwordInput, gateway())).resolves.toEqual({
      status: "success",
      message: "비밀번호를 변경했어요.",
    });
  });

  it("exposes session expiry as an explicit unauthenticated state", async () => {
    await expect(updateOwnProfile(profileInput, gateway({
      async updateProfile() { return "unauthenticated"; },
    }))).resolves.toEqual({ status: "unauthenticated" });
    await expect(changeOwnPassword(passwordInput, gateway({
      async changePassword() { return "unauthenticated"; },
    }))).resolves.toEqual({ status: "unauthenticated" });
  });

  it("maps current-password rejection to a safe current-password error", async () => {
    await expect(changeOwnPassword(passwordInput, gateway({
      async changePassword() { return "invalid-current-password"; },
    }))).resolves.toEqual({
      status: "error",
      message: "현재 비밀번호를 확인해 주세요.",
    });
  });

  it("maps provider failures to retry-safe messages", async () => {
    await expect(updateOwnProfile(profileInput, gateway({
      async updateProfile() { throw new Error("provider secret"); },
    }))).resolves.toEqual({
      status: "error",
      message: "프로필을 저장하지 못했습니다. 다시 시도해 주세요.",
    });
    await expect(changeOwnPassword(passwordInput, gateway({
      async changePassword() { return "error"; },
    }))).resolves.toEqual({
      status: "error",
      message: "비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.",
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  formDataToPasswordChangeInput,
  formDataToProfileInput,
  passwordChangeFormSchema,
  profileFormSchema,
} from "@/features/profile/schemas";

describe("profile schemas", () => {
  it("normalizes display name and phone", () => {
    expect(profileFormSchema.parse({
      displayName: "  사용자 이름  ",
      phone: "010-1234-5678",
    })).toEqual({ displayName: "사용자 이름", phone: "01012345678" });
  });

  it.each([
    { displayName: "", phone: "01012345678" },
    { displayName: "a".repeat(31), phone: "01012345678" },
    { displayName: "사용자", phone: "010 1234 5678" },
    { displayName: "사용자", phone: "" },
  ])("rejects invalid profile input %#", (input) => {
    expect(profileFormSchema.safeParse(input).success).toBe(false);
  });

  it("requires the current password and matching replacement passwords", () => {
    expect(passwordChangeFormSchema.safeParse({
      currentPassword: "",
      newPassword: "new-password1!",
      confirmPassword: "new-password1!",
    }).success).toBe(false);
    expect(passwordChangeFormSchema.safeParse({
      currentPassword: "old-password1!",
      newPassword: "new-password1!",
      confirmPassword: "different-password!",
    }).success).toBe(false);
  });

  it("converts valid string FormData into normalized profile and password input", () => {
    const profileData = new FormData();
    profileData.set("displayName", "  사용자 이름  ");
    profileData.set("phone", "010-1234-5678");
    const passwordData = new FormData();
    passwordData.set("currentPassword", "old-password1!");
    passwordData.set("newPassword", "new-password1!");
    passwordData.set("confirmPassword", "new-password1!");

    expect(formDataToProfileInput(profileData)).toMatchObject({
      success: true,
      data: { displayName: "사용자 이름", phone: "01012345678" },
    });
    expect(formDataToPasswordChangeInput(passwordData)).toMatchObject({
      success: true,
      data: { currentPassword: "old-password1!", newPassword: "new-password1!" },
    });
  });

  it("rejects a file where profile FormData requires a string", () => {
    const data = new FormData();
    data.set("displayName", new File(["사용자 이름"], "name.txt"));
    data.set("phone", "010-1234-5678");

    expect(formDataToProfileInput(data).success).toBe(false);
  });
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { PasswordChangeForm } from "@/features/profile/password-change-form";
import { ProfileForm } from "@/features/profile/profile-form";
import type { ProfileActionState, ProfilePageData } from "@/features/profile/types";

const data: ProfilePageData = {
  displayName: "포켓",
  email: "pocket@example.com",
  phone: "01012345678",
};

const idleAction = async (): Promise<ProfileActionState> => ({ status: "idle" });

afterEach(cleanup);

describe("profile settings forms", () => {
  it("shows saved name and formatted phone while keeping the enrollment email outside submitted data", async () => {
    const submitted: FormData[] = [];
    const user = userEvent.setup();
    render(<ProfileForm action={async (_state, formData) => {
      submitted.push(formData);
      return { status: "success", message: "프로필을 저장했어요." };
    }} data={data} />);

    expect(screen.getByLabelText("사용자명")).toHaveValue("포켓");
    expect(screen.getByLabelText("전화번호")).toHaveValue("010-1234-5678");
    expect(screen.getByLabelText("가입 이메일")).toHaveValue("pocket@example.com");
    expect(screen.getByLabelText("가입 이메일")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("가입 이메일")).not.toHaveAttribute("name");

    await user.click(screen.getByRole("button", { name: "프로필 저장" }));

    await waitFor(() => expect(submitted).toHaveLength(1));
    expect(submitted[0].get("displayName")).toBe("포켓");
    expect(submitted[0].get("phone")).toBe("010-1234-5678");
    expect(submitted[0].has("email")).toBe(false);
    expect(await screen.findByRole("status")).toHaveTextContent("프로필을 저장했어요.");
  });

  it("shows field errors returned by the profile save action", async () => {
    const user = userEvent.setup();
    render(<ProfileForm action={async () => ({
      status: "error",
      message: "입력한 내용을 확인해 주세요.",
      fieldErrors: { displayName: ["사용자명을 입력해 주세요."] },
    })} data={data} />);

    await user.click(screen.getByRole("button", { name: "프로필 저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("입력한 내용을 확인해 주세요.");
    expect(screen.getByText("사용자명을 입력해 주세요.")).toBeVisible();
    expect(screen.getByLabelText("사용자명")).toHaveAttribute("aria-invalid", "true");
  });

  it("locks every profile input while a save is pending", async () => {
    let finish!: (state: ProfileActionState) => void;
    const pending = new Promise<ProfileActionState>((resolve) => { finish = resolve; });
    const user = userEvent.setup();
    render(<ProfileForm action={() => pending} data={data} />);

    await user.click(screen.getByRole("button", { name: "프로필 저장" }));

    await waitFor(() => {
      expect(screen.getByLabelText("사용자명")).toBeDisabled();
      expect(screen.getByLabelText("전화번호")).toBeDisabled();
      expect(screen.getByLabelText("가입 이메일")).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "처리 중…" })).toBeDisabled();
    finish({ status: "success", message: "프로필을 저장했어요." });
    expect(await screen.findByRole("status")).toHaveTextContent("프로필을 저장했어요.");
  });

  it("uses required password fields, correct autocomplete tokens, and a full-device logout notice", () => {
    render(<PasswordChangeForm action={idleAction} />);

    expect(screen.getByLabelText("현재 비밀번호")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("새 비밀번호")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("새 비밀번호 확인")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("현재 비밀번호")).toBeRequired();
    expect(screen.getByLabelText("새 비밀번호")).toHaveAttribute("minlength", "8");
    expect(screen.getByLabelText("새 비밀번호 확인")).toHaveAttribute("minlength", "8");
    expect(screen.getByText(/모든 기기에서 로그아웃/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "모든 기기에서 로그아웃" })).not.toBeInTheDocument();
  });

  it("keeps profile values when the separate password form returns an error", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ProfileForm action={idleAction} data={data} />
        <PasswordChangeForm action={async () => ({ status: "error", message: "현재 비밀번호가 일치하지 않습니다." })} />
      </>,
    );

    await user.clear(screen.getByLabelText("사용자명"));
    await user.type(screen.getByLabelText("사용자명"), "새 포켓");
    await user.click(screen.getByRole("button", { name: "비밀번호 변경" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("현재 비밀번호가 일치하지 않습니다.");
    expect(screen.getByLabelText("사용자명")).toHaveValue("새 포켓");
    expect(screen.getByLabelText("전화번호")).toHaveValue("010-1234-5678");
  });
});

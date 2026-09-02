import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({
  forgotPasswordAction: vi.fn(),
  loginAction: vi.fn(),
  resetPasswordAction: vi.fn(),
}));

import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { LoginForm } from "@/features/auth/login-form";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import LoginPage from "@/app/(auth)/login/page";

afterEach(cleanup);

describe("password recovery notices", () => {
  it("explains that an expired recovery link needs a new request", () => {
    render(<ForgotPasswordForm notice="재설정 링크가 만료됐습니다. 새 링크를 요청해 주세요." />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "재설정 링크가 만료됐습니다. 새 링크를 요청해 주세요.",
    );
  });

  it("confirms a completed password change on the login form", () => {
    render(<LoginForm notice="비밀번호가 변경됐습니다. 새 비밀번호로 로그인해 주세요." />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "비밀번호가 변경됐습니다. 새 비밀번호로 로그인해 주세요.",
    );
  });

  it("keeps the password-reset completion notice on the login page", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ passwordReset: "1" }) }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "비밀번호가 변경됐습니다. 새 비밀번호로 로그인해 주세요.",
    );
  });

  it("shows the account-settings password-change notice on the login page", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ passwordChanged: "1" }) }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "비밀번호가 변경됐습니다. 새 비밀번호로 다시 로그인해 주세요.",
    );
  });

  it("offers a new recovery request from the replacement-password form", () => {
    render(<ResetPasswordForm />);

    expect(screen.getByRole("link", { name: "새 재설정 링크 요청하기" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});

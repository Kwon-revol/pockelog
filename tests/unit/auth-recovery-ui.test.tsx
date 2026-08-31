import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({
  forgotPasswordAction: vi.fn(),
  loginAction: vi.fn(),
}));

import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { LoginForm } from "@/features/auth/login-form";

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
});

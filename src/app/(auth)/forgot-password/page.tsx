import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "비밀번호 찾기" };

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-950">비밀번호 찾기</h1>
        <p className="mt-2 leading-6 text-slate-500">
          가입한 이메일로 재설정 링크를 보내드릴게요.
        </p>
      </div>
      <ForgotPasswordForm />
    </>
  );
}

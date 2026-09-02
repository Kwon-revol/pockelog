import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getPasswordRecoverySession } from "@/features/auth/password-recovery-session";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "새 비밀번호 설정" };

export default async function ResetPasswordPage() {
  const recoverySession = await getPasswordRecoverySession();
  if (!recoverySession) redirect("/forgot-password?invalidLink=1");

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-950">새 비밀번호 설정</h1>
        <p className="mt-2 text-slate-500">앞으로 사용할 비밀번호를 입력하세요.</p>
      </div>
      <ResetPasswordForm />
    </>
  );
}

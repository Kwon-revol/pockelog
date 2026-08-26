import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/login-form";
import { safeNextPath } from "@/features/auth/auth-workflows";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-950">다시 만나서 반가워요</h1>
        <p className="mt-2 text-slate-500">아이디 또는 이메일로 로그인하세요.</p>
      </div>
      <LoginForm nextPath={safeNextPath(next)} />
    </>
  );
}

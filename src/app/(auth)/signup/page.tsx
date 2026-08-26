import type { Metadata } from "next";

import { SignupForm } from "@/features/auth/signup-form";

export const metadata: Metadata = { title: "회원가입" };

export default function SignupPage() {
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-950">내 장부 만들기</h1>
        <p className="mt-2 text-slate-500">간단한 정보만 입력하면 바로 시작할 수 있어요.</p>
      </div>
      <SignupForm />
    </>
  );
}

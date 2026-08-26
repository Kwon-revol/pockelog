import Link from "next/link";

import { PRODUCT_NAME } from "@/shared/config/product";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e7fbf4_0,transparent_40%),#f5f8f7] px-5 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="mb-8 block text-center text-3xl font-black tracking-[-0.05em] text-slate-950">
          {PRODUCT_NAME}
        </Link>
        <section className="rounded-[2rem] border border-white bg-white p-6 shadow-[0_22px_70px_rgba(24,78,63,0.10)] sm:p-10">
          {children}
        </section>
      </div>
    </main>
  );
}

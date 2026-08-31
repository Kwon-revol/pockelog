import { type NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/features/auth/auth-workflows";
import { createServerClient } from "@/shared/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, request.url));
    }
  }

  const errorPath = nextPath === "/reset-password"
    ? "/forgot-password?invalidLink=1"
    : "/login?callbackError=1";

  return NextResponse.redirect(new URL(errorPath, request.url));
}

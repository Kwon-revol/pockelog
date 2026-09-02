import { type NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/features/auth/auth-workflows";
import {
  createPasswordRecoveryToken,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_MAX_AGE_SECONDS,
} from "@/features/auth/password-recovery-state";
import { createServerClient } from "@/shared/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const recoveryHash = tokenHash
    && request.nextUrl.searchParams.get("type") === "recovery"
    ? tokenHash
    : null;
  const nextPath = recoveryHash
    ? "/reset-password"
    : safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code || recoveryHash) {
    try {
      const supabase = await createServerClient();
      const { data, error } = recoveryHash
        ? await supabase.auth.verifyOtp({
            token_hash: recoveryHash,
            type: "recovery",
          })
        : await supabase.auth.exchangeCodeForSession(code!);

      if (!error) {
        const response = NextResponse.redirect(new URL(nextPath, request.url));
        const recoveredUserId = data.user?.id ?? data.session?.user.id;
        if (nextPath === "/reset-password" && recoveredUserId) {
          response.cookies.set({
            name: PASSWORD_RECOVERY_COOKIE,
            value: createPasswordRecoveryToken(recoveredUserId),
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/reset-password",
            maxAge: PASSWORD_RECOVERY_MAX_AGE_SECONDS,
          });
        }
        return response;
      }
    } catch {
      // Invalid, expired, or unavailable recovery callbacks share one safe destination.
    }
  }

  const errorPath = nextPath === "/reset-password"
    ? "/forgot-password?invalidLink=1"
    : "/login?callbackError=1";

  return NextResponse.redirect(new URL(errorPath, request.url));
}

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnv } from "@/shared/config/env";
import { getAuthRedirect } from "@/shared/supabase/auth-routing";

function copyCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
}

export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const redirectPath = getAuthRedirect(requestPath, Boolean(data?.claims?.sub));

  if (!redirectPath) {
    return response;
  }

  const redirectResponse = NextResponse.redirect(
    new URL(redirectPath, request.url),
  );
  copyCookies(response, redirectResponse);

  return redirectResponse;
}

import "server-only";

import type { AuthGateway } from "@/features/auth/auth-workflows";
import type { SignupInput } from "@/features/auth/schemas";
import { getPublicEnv } from "@/shared/config/env";
import { createAdminClient } from "@/shared/supabase/admin";
import { createServerClient } from "@/shared/supabase/server";

export async function createSupabaseAuthGateway(): Promise<AuthGateway> {
  const supabase = await createServerClient();

  return {
    async signUp(input: SignupInput) {
      const env = getPublicEnv();
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/ledger`,
          data: {
            login_id: input.loginId,
            display_name: input.displayName,
            phone_normalized: input.phone,
          },
        },
      });

      return { error: Boolean(error), hasSession: Boolean(data.session) };
    },

    async resolveLoginEmail(loginId) {
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("resolve_login_email", {
        candidate_login_id: loginId,
      });

      return error || typeof data !== "string" ? null : data;
    },

    async signInWithPassword(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { error: Boolean(error) };
    },

    async signOut() {
      await supabase.auth.signOut();
    },
  };
}

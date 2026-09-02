import "server-only";

import { cookies } from "next/headers";

import {
  isValidPasswordRecoveryToken,
  PASSWORD_RECOVERY_COOKIE,
} from "@/features/auth/password-recovery-state";
import { createServerClient } from "@/shared/supabase/server";

export async function getPasswordRecoverySession() {
  try {
    const supabase = await createServerClient();
    const cookieStore = await cookies();
    const recoveryToken = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value;
    const { data, error } = await supabase.auth.getUser();

    if (
      error
      || !data.user
      || !isValidPasswordRecoveryToken(recoveryToken, data.user.id)
    ) {
      return null;
    }

    return { cookieStore, supabase };
  } catch {
    return null;
  }
}

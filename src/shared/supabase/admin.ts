import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/shared/config/env";
import { getServerEnv } from "@/shared/config/server-env";

export function createAdminClient() {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

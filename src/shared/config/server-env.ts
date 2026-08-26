import "server-only";

import { parseServerEnv } from "@/shared/config/env-schema";

export function getServerEnv() {
  return parseServerEnv({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}

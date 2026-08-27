import "server-only";

import { mapSettingsPageData } from "@/features/settings/query-utils";
import type { SettingsPageData } from "@/features/settings/types";
import { createServerClient } from "@/shared/supabase/server";

export class SettingsQueryError extends Error {}

export async function getSettingsPageData(): Promise<SettingsPageData | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: privateProfile, error: profileError } = await supabase
    .from("user_private_profiles")
    .select("default_ledger_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError || !privateProfile?.default_ledger_id) {
    throw new SettingsQueryError("기본 장부를 불러오지 못했습니다.");
  }

  const ledgerId = privateProfile.default_ledger_id;
  const [ledgerResult, memberResult, categoryResult] = await Promise.all([
    supabase.from("ledgers").select("id,name,period_start_day").eq("id", ledgerId).maybeSingle(),
    supabase.from("ledger_members").select("role").eq("ledger_id", ledgerId).eq("user_id", user.id).maybeSingle(),
    supabase.from("categories").select("id,type,name,color,sort_order,is_active").eq("ledger_id", ledgerId),
  ]);

  if (
    ledgerResult.error || !ledgerResult.data
    || memberResult.error || !memberResult.data
    || categoryResult.error
  ) {
    throw new SettingsQueryError("설정 정보를 불러오지 못했습니다.");
  }

  return mapSettingsPageData(ledgerResult.data, memberResult.data, categoryResult.data ?? []);
}

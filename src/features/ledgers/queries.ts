import "server-only";

import { createServerClient } from "@/shared/supabase/server";

export type CurrentAppContext = {
  userName: string;
  ledgerName: string;
};

export async function getCurrentAppContext(): Promise<CurrentAppContext | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: privateProfile }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_private_profiles").select("default_ledger_id").eq("user_id", user.id).maybeSingle(),
  ]);

  let ledgerName = "내 장부";
  if (privateProfile?.default_ledger_id) {
    const { data: ledger } = await supabase.from("ledgers").select("name").eq("id", privateProfile.default_ledger_id).maybeSingle();
    ledgerName = ledger?.name ?? ledgerName;
  }

  return {
    userName: profile?.display_name ?? user.user_metadata.display_name ?? "사용자",
    ledgerName,
  };
}

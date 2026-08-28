import { createClient } from "@supabase/supabase-js";

export function assertExpectedProjectHost(urlValue: string, projectRef: string) {
  const actualHost = new URL(urlValue).hostname;
  const expectedHost = `${projectRef}.supabase.co`;
  if (actualHost !== expectedHost) {
    throw new Error(`E2E Supabase project mismatch: expected ${expectedHost}`);
  }
}

export async function assertDestructiveE2EAllowed(
  readDatabaseMarker: () => Promise<boolean>,
) {
  if (!(await readDatabaseMarker())) {
    throw new Error("The database marker does not allow destructive E2E tests");
  }
}

export async function verifyHostedSupabaseE2ESafety() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  assertExpectedProjectHost(url, process.env.E2E_SUPABASE_PROJECT_REF!);

  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await assertDestructiveE2EAllowed(async () => {
    const { data, error } = await admin.rpc("is_destructive_e2e_allowed");
    if (error) throw new Error(`Unable to verify E2E database marker: ${error.message}`);
    return data === true;
  });
}

export async function deleteE2EUsersByEmail(emails: string[]) {
  await verifyHostedSupabaseE2ESafety();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const targets = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Unable to list E2E users: ${error.message}`);
    targets.push(...data.users.filter((user) => user.email && emails.includes(user.email)));
    if (data.users.length < perPage) break;
  }
  for (const user of targets) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error(`Unable to delete E2E user: ${deleteError.message}`);
  }
}

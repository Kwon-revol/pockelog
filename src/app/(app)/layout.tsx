import { redirect } from "next/navigation";

import { getCurrentAppContext } from "@/features/ledgers/queries";
import { AppShell } from "@/shared/ui/app-shell";

export default async function ProtectedAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getCurrentAppContext();
  if (!context) redirect("/login");

  return <AppShell ledgerName={context.currentLedger.name} userName={context.userName}>{children}</AppShell>;
}

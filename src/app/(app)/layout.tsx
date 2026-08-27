import { redirect } from "next/navigation";

import { getCurrentAppContext } from "@/features/ledgers/queries";
import { switchLedgerAction } from "@/features/shared-ledgers/actions";
import { AppShell } from "@/shared/ui/app-shell";

export default async function ProtectedAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getCurrentAppContext();
  if (!context) redirect("/login");

  return (
    <AppShell
      currentLedger={context.currentLedger}
      ledgers={context.ledgers}
      pendingInvitationCount={context.pendingInvitationCount}
      switchLedgerAction={switchLedgerAction}
      userName={context.userName}
    >
      {children}
    </AppShell>
  );
}

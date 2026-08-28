"use server";

import { revalidatePath } from "next/cache";

import {
  createSharedLedgerSchema,
  deleteSharedLedgerSchema,
  formValue,
  idSchema,
  inviteLedgerMemberSchema,
} from "@/features/shared-ledgers/schemas";
import { createSupabaseSharedLedgerGateway } from "@/features/shared-ledgers/supabase-gateway";
import type { SharedLedgerActionState } from "@/features/shared-ledgers/types";
import {
  createSharedLedger,
  deleteSharedLedger,
  inviteLedgerMember,
  leaveSharedLedger,
  removeLedgerMember,
  respondToInvitation,
  revokeInvitation,
  switchLedger,
} from "@/features/shared-ledgers/workflows";

function invalidState(
  result: { error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } } },
): SharedLedgerActionState {
  return { status: "error", message: "입력한 내용을 확인해 주세요.", fieldErrors: result.error.flatten().fieldErrors };
}

function refreshLedgerConsumers() {
  revalidatePath("/", "layout");
}

export async function createSharedLedgerAction(
  _previous: SharedLedgerActionState,
  formData: FormData,
): Promise<SharedLedgerActionState> {
  const parsed = createSharedLedgerSchema.safeParse({ name: formValue(formData, "name") });
  if (!parsed.success) return invalidState(parsed);
  const result = await createSharedLedger(parsed.data, await createSupabaseSharedLedgerGateway());
  if (result.status === "success") refreshLedgerConsumers();
  return result;
}

export async function switchLedgerAction(ledgerId: string) {
  if (!idSchema.safeParse(ledgerId).success) return { status: "error", message: "장부를 전환하지 못했습니다." } as SharedLedgerActionState;
  const result = await switchLedger(ledgerId, await createSupabaseSharedLedgerGateway());
  if (result.status === "success") refreshLedgerConsumers();
  return result;
}

export async function inviteLedgerMemberAction(
  _previous: SharedLedgerActionState,
  formData: FormData,
): Promise<SharedLedgerActionState> {
  const parsed = inviteLedgerMemberSchema.safeParse({
    ledgerId: formValue(formData, "ledgerId"),
    identifier: formValue(formData, "identifier"),
  });
  if (!parsed.success) return invalidState(parsed);
  const result = await inviteLedgerMember(parsed.data, await createSupabaseSharedLedgerGateway());
  if (result.status === "success") refreshLedgerConsumers();
  return result;
}

export async function respondToInvitationAction(invitationId: string, response: "accept" | "decline") {
  const result = await respondToInvitation(invitationId, response, await createSupabaseSharedLedgerGateway());
  if (result.status === "success") refreshLedgerConsumers();
  return result;
}

export async function revokeInvitationAction(invitationId: string) {
  const result = await revokeInvitation(invitationId, await createSupabaseSharedLedgerGateway());
  if (result.status === "success") refreshLedgerConsumers();
  return result;
}

export async function removeLedgerMemberAction(ledgerId: string, userId: string) {
  const result = await removeLedgerMember(ledgerId, userId, await createSupabaseSharedLedgerGateway());
  if (result.status === "success") refreshLedgerConsumers();
  return result;
}

export async function leaveSharedLedgerAction(ledgerId: string) {
  const result = await leaveSharedLedger(ledgerId, await createSupabaseSharedLedgerGateway());
  if (result.status === "success") refreshLedgerConsumers();
  return result;
}

export async function deleteSharedLedgerAction(
  _previous: SharedLedgerActionState,
  formData: FormData,
): Promise<SharedLedgerActionState> {
  const parsed = deleteSharedLedgerSchema.safeParse({
    ledgerId: formValue(formData, "ledgerId"),
    confirmationName: formValue(formData, "confirmationName"),
  });
  if (!parsed.success) return invalidState(parsed);
  const result = await deleteSharedLedger(parsed.data, await createSupabaseSharedLedgerGateway());
  if (result.status === "success") refreshLedgerConsumers();
  return result;
}

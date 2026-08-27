import "server-only";

import {
  isForbidden,
  mapInvitationCreateError,
} from "@/features/shared-ledgers/gateway-utils";
import type { SharedLedgerGateway } from "@/features/shared-ledgers/workflows";
import { createAdminClient } from "@/shared/supabase/admin";
import { createServerClient } from "@/shared/supabase/server";

export async function createSupabaseSharedLedgerGateway(): Promise<SharedLedgerGateway> {
  const supabase = await createServerClient();

  return {
    async getUserId() {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },

    async createSharedLedger(name) {
      const { error } = await supabase.rpc("create_shared_ledger", { ledger_name: name });
      if (!error) return "created";
      if (error.code === "23505") return "duplicate";
      return isForbidden(error) ? "forbidden" : "error";
    },

    async switchLedger(ledgerId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "forbidden";
      const { data, error } = await supabase
        .from("user_private_profiles")
        .update({ default_ledger_id: ledgerId })
        .eq("user_id", user.id)
        .select("user_id")
        .maybeSingle();
      return !error && data ? "updated" : isForbidden(error) || !data ? "forbidden" : "error";
    },

    async resolveInvitationTarget(identifier, currentUserId) {
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("resolve_invitation_target", {
        candidate_identifier: identifier,
      });
      if (error) return { status: "error" };
      if (!data) return { status: "not_found" };
      if (data === currentUserId) return { status: "self" };
      return { status: "found", userId: String(data) };
    },

    async createInvitation(ledgerId, targetUserId) {
      const { error } = await supabase.rpc("create_ledger_invitation", {
        target_ledger_id: ledgerId,
        invited_user_id: targetUserId,
      });
      return error ? mapInvitationCreateError(error) : "created";
    },

    async respondToInvitation(invitationId, response) {
      const { data, error } = await supabase.rpc("respond_to_ledger_invitation", {
        target_invitation_id: invitationId,
        response,
      });
      if (error) return isForbidden(error) ? "forbidden" : "error";
      return ["accepted", "declined", "expired", "processed"].includes(String(data))
        ? data as "accepted" | "declined" | "expired" | "processed"
        : "error";
    },

    async revokeInvitation(invitationId) {
      const { data, error } = await supabase.rpc("revoke_ledger_invitation", {
        target_invitation_id: invitationId,
      });
      if (error) return isForbidden(error) ? "forbidden" : "error";
      return data === "revoked" || data === "processed" ? data : "error";
    },

    async removeMember(ledgerId, userId) {
      const { data, error } = await supabase.rpc("remove_ledger_member", {
        target_ledger_id: ledgerId,
        target_user_id: userId,
      });
      if (error) return isForbidden(error) ? "forbidden" : "error";
      return ["removed", "owner", "missing"].includes(String(data))
        ? data as "removed" | "owner" | "missing"
        : "error";
    },

    async leaveSharedLedger(ledgerId) {
      const { data, error } = await supabase.rpc("leave_shared_ledger", { target_ledger_id: ledgerId });
      if (error) return "error";
      return ["left", "personal", "owner", "missing"].includes(String(data))
        ? data as "left" | "personal" | "owner" | "missing"
        : "error";
    },

    async deleteSharedLedger(ledgerId, confirmationName) {
      const { data, error } = await supabase.rpc("delete_shared_ledger", {
        target_ledger_id: ledgerId,
        confirmation_name: confirmationName,
      });
      if (error) return isForbidden(error) ? "forbidden" : "error";
      return ["deleted", "personal", "confirmation"].includes(String(data))
        ? data as "deleted" | "personal" | "confirmation"
        : "error";
    },
  };
}

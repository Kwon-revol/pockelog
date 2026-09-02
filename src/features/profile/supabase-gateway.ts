import "server-only";

import type {
  PasswordChangeInput,
  PasswordMutationResult,
  ProfileGateway,
  ProfileInput,
  ProfileMutationResult,
} from "@/features/profile/types";
import { createServerClient } from "@/shared/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

async function updateProfile(
  supabase: ServerClient,
  input: ProfileInput,
): Promise<ProfileMutationResult> {
  try {
    const { data: current, error: currentError } = await supabase.auth.getUser();
    if (currentError || !current.user) return "unauthenticated";

    const { data, error } = await supabase.rpc("update_my_profile", {
      new_display_name: input.displayName,
      new_phone_normalized: input.phone,
    });
    if (error || data !== "updated") return "error";
    return "updated";
  } catch {
    return "error";
  }
}

async function changePassword(
  supabase: ServerClient,
  input: PasswordChangeInput,
): Promise<PasswordMutationResult> {
  try {
    const { data: current, error: currentError } = await supabase.auth.getUser();
    if (currentError || !current.user?.email) return "unauthenticated";

    const verified = await supabase.auth.signInWithPassword({
      email: current.user.email,
      password: input.currentPassword,
    });
    if (verified.error) return "invalid-current-password";
    if (verified.data.user?.id !== current.user.id) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // The verification response may have replaced the session; force login either way.
      }
      return "unauthenticated";
    }

    const changed = await supabase.auth.updateUser({ password: input.newPassword });
    if (changed.error) return "error";

    try {
      const globalLogout = await supabase.auth.signOut({ scope: "global" });
      if (globalLogout.error) {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // The password changed; continuing to login is the safe destination.
        }
      }
    } catch {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // The password changed; continuing to login is the safe destination.
      }
    }
    return "changed";
  } catch {
    return "error";
  }
}

function unavailableGateway(): ProfileGateway {
  return {
    async updateProfile() {
      return "error";
    },
    async changePassword() {
      return "error";
    },
  };
}

export async function createSupabaseProfileGateway(): Promise<ProfileGateway> {
  try {
    const supabase = await createServerClient();
    return {
      updateProfile(input) {
        return updateProfile(supabase, input);
      },
      changePassword(input) {
        return changePassword(supabase, input);
      },
    };
  } catch {
    return unavailableGateway();
  }
}

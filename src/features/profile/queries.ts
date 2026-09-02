import "server-only";

import type { ProfilePageData } from "@/features/profile/types";
import { createServerClient } from "@/shared/supabase/server";

export class ProfileQueryError extends Error {
  constructor() {
    super("프로필을 불러오지 못했습니다.");
  }
}

export async function getProfilePageData(): Promise<ProfilePageData | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    if (!user.email) throw new ProfileQueryError();

    const [profileResult, privateProfileResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_private_profiles")
        .select("phone_normalized")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (
      profileResult.error
      || privateProfileResult.error
      || !profileResult.data
      || !privateProfileResult.data
    ) {
      throw new ProfileQueryError();
    }

    return {
      displayName: profileResult.data.display_name,
      email: user.email,
      phone: privateProfileResult.data.phone_normalized,
    };
  } catch (error) {
    if (error instanceof ProfileQueryError) throw error;
    throw new ProfileQueryError();
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  formDataToPasswordChangeInput,
  formDataToProfileInput,
} from "@/features/profile/schemas";
import { createSupabaseProfileGateway } from "@/features/profile/supabase-gateway";
import type { ProfileActionState, ProfileGateway } from "@/features/profile/types";
import { changeOwnPassword, updateOwnProfile } from "@/features/profile/workflows";

const PROFILE_SAVE_FAILED = "프로필을 저장하지 못했습니다. 다시 시도해 주세요.";
const PASSWORD_CHANGE_FAILED = "비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.";
const PROFILE_PATHS = ["/settings", "/ledger", "/statistics", "/settings/trash"];

function invalidState(
  result: {
    error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } };
  },
): ProfileActionState {
  return {
    status: "error",
    message: "입력한 내용을 확인해 주세요.",
    fieldErrors: result.error.flatten().fieldErrors,
  };
}

async function getGateway(failureMessage: string): Promise<
  { gateway: ProfileGateway } | { state: ProfileActionState }
> {
  try {
    return { gateway: await createSupabaseProfileGateway() };
  } catch {
    return { state: { status: "error", message: failureMessage } };
  }
}

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = formDataToProfileInput(formData);
  if (!parsed.success) return invalidState(parsed);

  const initialized = await getGateway(PROFILE_SAVE_FAILED);
  if ("state" in initialized) return initialized.state;

  const result = await updateOwnProfile(parsed.data, initialized.gateway);
  if (result.status === "unauthenticated") {
    redirect("/login?next=%2Fsettings");
  }
  if (result.status === "success") {
    for (const path of PROFILE_PATHS) revalidatePath(path);
  }
  return result;
}

export async function changePasswordAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = formDataToPasswordChangeInput(formData);
  if (!parsed.success) return invalidState(parsed);

  const initialized = await getGateway(PASSWORD_CHANGE_FAILED);
  if ("state" in initialized) return initialized.state;

  const result = await changeOwnPassword(parsed.data, initialized.gateway);
  if (result.status === "unauthenticated") {
    redirect("/login?next=%2Fsettings");
  }
  if (result.status === "success") {
    redirect("/login?passwordChanged=1");
  }
  return result;
}

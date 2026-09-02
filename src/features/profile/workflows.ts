import type {
  PasswordChangeInput,
  ProfileActionState,
  ProfileGateway,
  ProfileInput,
} from "@/features/profile/types";

const PROFILE_SAVE_FAILED = "프로필을 저장하지 못했습니다. 다시 시도해 주세요.";
const PASSWORD_CHANGE_FAILED = "비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.";

export async function updateOwnProfile(
  input: ProfileInput,
  gateway: ProfileGateway,
): Promise<ProfileActionState> {
  try {
    const result = await gateway.updateProfile(input);
    if (result === "updated") return { status: "success", message: "프로필을 저장했어요." };
    if (result === "unauthenticated") return { status: "unauthenticated" };
    return { status: "error", message: PROFILE_SAVE_FAILED };
  } catch {
    return { status: "error", message: PROFILE_SAVE_FAILED };
  }
}

export async function changeOwnPassword(
  input: PasswordChangeInput,
  gateway: ProfileGateway,
): Promise<ProfileActionState> {
  try {
    const result = await gateway.changePassword(input);
    if (result === "changed") return { status: "success", message: "비밀번호를 변경했어요." };
    if (result === "invalid-current-password") {
      return { status: "error", message: "현재 비밀번호를 확인해 주세요." };
    }
    if (result === "unauthenticated") return { status: "unauthenticated" };
    return { status: "error", message: PASSWORD_CHANGE_FAILED };
  } catch {
    return { status: "error", message: PASSWORD_CHANGE_FAILED };
  }
}

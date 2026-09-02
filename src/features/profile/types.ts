export type ProfilePageData = {
  displayName: string;
  email: string;
  phone: string;
};

export type ProfileInput = { displayName: string; phone: string };
export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type ProfileActionState = {
  status: "idle" | "success" | "error" | "unauthenticated";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type ProfileFormAction = (
  state: ProfileActionState,
  formData: FormData,
) => Promise<ProfileActionState>;

export type ProfileMutationResult =
  | "updated"
  | "unauthenticated"
  | "error";

export type PasswordMutationResult =
  | "changed"
  | "invalid-current-password"
  | "unauthenticated"
  | "error";

export interface ProfileGateway {
  updateProfile(input: ProfileInput): Promise<ProfileMutationResult>;
  changePassword(input: PasswordChangeInput): Promise<PasswordMutationResult>;
}

export const initialProfileActionState: ProfileActionState = { status: "idle" };

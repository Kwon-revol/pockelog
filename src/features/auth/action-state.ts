export type AuthFieldErrors = Record<string, string[] | undefined>;

export type AuthActionState = {
  status: "idle" | "error" | "success" | "confirmation-required";
  message?: string;
  fieldErrors?: AuthFieldErrors;
};

export const initialAuthActionState: AuthActionState = { status: "idle" };

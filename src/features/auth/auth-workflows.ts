import type { LoginInput, SignupInput } from "@/features/auth/schemas";

export const AUTHENTICATION_ERROR_MESSAGE =
  "아이디 또는 이메일과 비밀번호를 확인해 주세요.";
export const SIGNUP_ERROR_MESSAGE =
  "회원가입을 완료하지 못했습니다. 입력 정보를 확인해 주세요.";

export interface AuthGateway {
  signUp(input: SignupInput): Promise<{ error: boolean; hasSession: boolean }>;
  resolveLoginEmail(loginId: string): Promise<string | null>;
  signInWithPassword(
    email: string,
    password: string,
  ): Promise<{ error: boolean }>;
  signOut(): Promise<void>;
}

export async function signupWithGateway(
  input: SignupInput,
  gateway: AuthGateway,
) {
  try {
    const result = await gateway.signUp(input);

    if (result.error) {
      return { status: "error" as const, message: SIGNUP_ERROR_MESSAGE };
    }

    return result.hasSession
      ? { status: "authenticated" as const }
      : { status: "confirmation-required" as const };
  } catch {
    return { status: "error" as const, message: SIGNUP_ERROR_MESSAGE };
  }
}

export async function loginWithGateway(
  input: LoginInput,
  gateway: AuthGateway,
) {
  try {
    const email = input.identifier.includes("@")
      ? input.identifier
      : await gateway.resolveLoginEmail(input.identifier);

    if (!email) {
      return {
        status: "error" as const,
        message: AUTHENTICATION_ERROR_MESSAGE,
      };
    }

    const result = await gateway.signInWithPassword(email, input.password);

    return result.error
      ? { status: "error" as const, message: AUTHENTICATION_ERROR_MESSAGE }
      : { status: "authenticated" as const };
  } catch {
    return { status: "error" as const, message: AUTHENTICATION_ERROR_MESSAGE };
  }
}

export function safeNextPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/ledger";
  }

  try {
    const baseUrl = "http://pockelog.local";
    const parsed = new URL(value, baseUrl);

    if (parsed.origin !== baseUrl) {
      return "/ledger";
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/ledger";
  }
}

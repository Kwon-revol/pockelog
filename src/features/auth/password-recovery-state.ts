import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/shared/config/server-env";

export const PASSWORD_RECOVERY_COOKIE = "pockelog-password-recovery";
export const PASSWORD_RECOVERY_MAX_AGE_SECONDS = 15 * 60;

type RecoveryPayload = {
  expiresAt: number;
  purpose: "password-recovery";
  userId: string;
  version: 1;
};

function signature(value: string) {
  const { SUPABASE_SECRET_KEY } = getServerEnv();
  return createHmac("sha256", SUPABASE_SECRET_KEY)
    .update(`pockelog:password-recovery:v1:${value}`)
    .digest("base64url");
}

export function createPasswordRecoveryToken(userId: string, now = Date.now()) {
  const payload: RecoveryPayload = {
    expiresAt: now + PASSWORD_RECOVERY_MAX_AGE_SECONDS * 1000,
    purpose: "password-recovery",
    userId,
    version: 1,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function isValidPasswordRecoveryToken(
  token: string | undefined,
  userId: string,
  now = Date.now(),
) {
  if (!token) return false;

  const [encoded, receivedSignature, extra] = token.split(".");
  if (!encoded || !receivedSignature || extra) return false;

  const expectedSignature = signature(encoded);
  const received = Buffer.from(receivedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<RecoveryPayload>;
    return payload.version === 1
      && payload.purpose === "password-recovery"
      && payload.userId === userId
      && typeof payload.expiresAt === "number"
      && payload.expiresAt > now;
  } catch {
    return false;
  }
}

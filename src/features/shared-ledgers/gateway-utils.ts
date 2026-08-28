export type DatabaseErrorLike = { code?: string; message?: string };

export function mapInvitationCreateError(
  error: DatabaseErrorLike,
): "duplicate" | "member" | "personal" | "self" | "forbidden" | "error" {
  if (error.code === "23505") return "duplicate";
  if (error.code === "42501") return "forbidden";
  if (error.message?.includes("target already member")) return "member";
  if (error.message?.includes("shared ledger required")) return "personal";
  if (error.message?.includes("cannot invite self")) return "self";
  return "error";
}

export function isForbidden(error: DatabaseErrorLike | null) {
  return error?.code === "42501";
}

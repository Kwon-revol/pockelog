const publicPaths = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

const guestOnlyPaths = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

export function isPublicPath(pathname: string) {
  return publicPaths.has(pathname) || pathname.startsWith("/auth/");
}

export function getAuthRedirect(requestPath: string, isAuthenticated: boolean) {
  const url = new URL(requestPath, "http://pockelog.local");
  const pathname = url.pathname;

  if (isAuthenticated && guestOnlyPaths.has(pathname)) {
    return "/ledger";
  }

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const safeNext = `${pathname}${url.search}`;
    return `/login?next=${encodeURIComponent(safeNext)}`;
  }

  return null;
}

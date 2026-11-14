import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  isPrivatePath,
  verifySessionToken,
} from "@/lib/auth/session";

/**
 * Route protection.
 *
 *  • Private routes without a valid session → /login?next=<path>
 *  • /login with a valid session           → /dashboard
 *
 * Runs on the Edge runtime, so only `jose` + Web Crypto are used.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const authenticated = session !== null;

  if (isPrivatePath(pathname) && !authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    const response = NextResponse.redirect(loginUrl);
    // Drop the stale/invalid cookie so the browser stops resending it.
    if (token !== undefined) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, static assets, and the favicon.
     * Keeping the matcher broad lets /login handle the already-authenticated
     * redirect without a second hop.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|csv)$).*)",
  ],
};

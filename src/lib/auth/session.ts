/**
 * Single-user session management.
 *
 * There is no user table and no sign-up flow. Identity is a signed HS256 JWT
 * in an HttpOnly cookie, verified by `middleware.ts` on every private route.
 *
 * Edge-runtime safe: `jose` and Web Crypto only, no Node built-ins.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import { getAdminPassword, getAdminUsername, getAuthSecret, getSessionMaxAge } from "@/lib/env";

export const SESSION_COOKIE = "pfos_session";

const ISSUER = "personal-finance-os";
const AUDIENCE = "personal-finance-os:single-user";

export interface SessionPayload extends JWTPayload {
  sub: string;
  role: "owner";
}

export interface SessionCookieSpec {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
  };
}

/** Sign a session token for the single owner identity. */
export async function createSessionToken(username: string): Promise<string> {
  const maxAge = getSessionMaxAge();
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(username)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + maxAge)
    .sign(getAuthSecret());
}

/** Verify a session token. Returns `null` for any invalid or expired token. */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (token === undefined || token === null || token.length === 0) return null;

  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string" || payload.role !== "owner") return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Constant-time string comparison.
 *
 * Avoids leaking credential length/prefix information through response timing.
 * Implemented without Node's `crypto.timingSafeEqual` so this module stays
 * usable from the Edge runtime.
 */
export function safeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const length = Math.max(aBytes.length, bBytes.length);

  let mismatch = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
}

/** Validate submitted credentials against the environment-configured owner. */
export function validateCredentials(username: string, password: string): boolean {
  const expectedUser = getAdminUsername();
  const expectedPass = getAdminPassword();

  // Both comparisons always run so the timing does not reveal which failed.
  const userOk = safeEqual(username, expectedUser);
  const passOk = safeEqual(password, expectedPass);
  return userOk && passOk;
}

export function sessionCookieSpec(token: string): SessionCookieSpec {
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: getSessionMaxAge(),
    },
  };
}

export function clearedSessionCookieSpec(): SessionCookieSpec {
  return {
    name: SESSION_COOKIE,
    value: "",
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  };
}

/** Routes that require a valid session. */
export const PRIVATE_ROUTES = [
  "/dashboard",
  "/pemasukan",
  "/pengeluaran",
  "/kanban",
  "/dompet",
  "/laporan",
  "/aturan",
] as const;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

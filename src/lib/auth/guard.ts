import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/auth/session";

/** Read and verify the current session, or `null` when unauthenticated. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()) !== null;
}

/**
 * Guard for Server Components and Server Actions.
 *
 * `middleware.ts` already blocks unauthenticated navigation; this is the
 * defence-in-depth check so a Server Action can never run unauthenticated.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (session === null) redirect("/login");
  return session;
}

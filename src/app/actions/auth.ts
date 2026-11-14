"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  clearedSessionCookieSpec,
  createSessionToken,
  sessionCookieSpec,
  validateCredentials,
} from "@/lib/auth/session";
import type { LoginState } from "@/lib/types/forms";
import { errorMessage } from "@/lib/utils";

/**
 * Validate the single owner identity and issue the session cookie.
 *
 * Failures return a deliberately generic message: never reveal whether the
 * username or the password was the wrong half.
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/dashboard");

  if (username.length === 0 || password.length === 0) {
    return { error: "Username dan password wajib diisi." };
  }

  try {
    if (!validateCredentials(username, password)) {
      // Flatten the timing of the failure path a little.
      await new Promise((resolve) => setTimeout(resolve, 350));
      return { error: "Kredensial tidak valid. Akses ditolak." };
    }

    const token = await createSessionToken(username);
    const spec = sessionCookieSpec(token);
    cookies().set(spec.name, spec.value, spec.options);
  } catch (error) {
    return { error: errorMessage(error, "Gagal membuat sesi. Periksa AUTH_SECRET.") };
  }

  // Only accept same-origin relative paths as the post-login destination.
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";

  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const spec = clearedSessionCookieSpec();
  cookies().set(spec.name, spec.value, spec.options);
  redirect("/login");
}

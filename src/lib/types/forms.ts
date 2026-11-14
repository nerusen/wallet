/**
 * Form-state shapes shared between Server Actions and Client Components.
 *
 * These live outside `src/app/actions/*` because a `"use server"` module may
 * only export async functions — a type export there is rejected at build time.
 */

export interface LoginState {
  error: string | null;
}

import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/lib/auth/guard";
import { todayWIB } from "@/lib/format";
import { fetchWallets } from "@/lib/supabase/queries";
import type { Wallet } from "@/lib/types/database";

/**
 * Private layout.
 *
 * `requireSession()` is defence in depth: `middleware.ts` already blocks
 * unauthenticated navigation, but a Server Component must never assume that.
 *
 * Wallets are loaded here because the Ctrl+K palette in the shell needs them
 * on every private page, and `today` is resolved server-side so the topbar's
 * first paint matches the server render exactly.
 */
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  let wallets: Wallet[] = [];
  try {
    wallets = await fetchWallets();
  } catch {
    // An unreachable or unconfigured Supabase instance must not 500 the whole
    // shell — each page renders its own actionable error state instead.
    wallets = [];
  }

  return (
    <AppShell wallets={wallets} today={todayWIB()}>
      {children}
    </AppShell>
  );
}

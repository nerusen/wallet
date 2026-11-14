import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { ChatMessage, ChatRole } from "@/lib/types/database";

/** Chat transcript persistence. Server-only; uses the service-role client. */

export async function fetchChatMessages(limit = 200): Promise<ChatMessage[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Most recent N turns, returned oldest-first for prompt replay. */
export async function fetchRecentChatMessages(limit: number): Promise<ChatMessage[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).reverse();
}

export async function insertChatMessage(
  role: ChatRole,
  content: string,
): Promise<ChatMessage> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ role, content })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAllChatMessages(): Promise<number> {
  const supabase = createServiceClient();

  const { count, error: countError } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true });

  if (countError) throw new Error(countError.message);

  // `delete()` requires a filter; this predicate matches every row.
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .not("id", "is", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

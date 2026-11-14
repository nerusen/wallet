import type { Metadata } from "next";

import { ChatRoom } from "@/components/assistant/chat-room";
import { LoadError } from "@/components/shell/page-header";
import { fetchChatMessages } from "@/lib/assistant/chat-store";
import { getGeminiModel, hasGeminiApiKey } from "@/lib/assistant/gemini";
import { todayWIB } from "@/lib/format";
import type { ChatMessage } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Assisten AI",
  description: "Asisten pengelolaan keuangan pribadi berbasis Gemini.",
};

export const dynamic = "force-dynamic";

export default async function AssistenPage() {
  const hasApiKey = hasGeminiApiKey();

  let messages: ChatMessage[] = [];
  let loadError: string | null = null;

  // A missing API key must not block the page: the chat viewport renders the
  // NO APIKEY AVAILABLE state instead, and the transcript is still readable.
  try {
    messages = await fetchChatMessages();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Gagal memuat riwayat obrolan.";
  }

  return (
    <>
      {loadError !== null && (
        <div className="px-4 pt-4 sm:px-6">
          <LoadError message={loadError} />
        </div>
      )}

      <ChatRoom
        initialMessages={messages}
        hasApiKey={hasApiKey}
        todayKey={todayWIB()}
        model={getGeminiModel()}
      />
    </>
  );
}

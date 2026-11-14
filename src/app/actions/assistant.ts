"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/guard";
import { deleteAllChatMessages } from "@/lib/assistant/chat-store";
import type { ActionResult } from "@/lib/types/database";
import { translateDbError } from "@/lib/utils";

/** Clear the whole transcript ("Reset Chat"). */
export async function resetChatAction(): Promise<ActionResult<{ deleted: number }>> {
  await requireSession();

  try {
    const deleted = await deleteAllChatMessages();
    revalidatePath("/assisten");
    return {
      ok: true,
      data: { deleted },
      message:
        deleted > 0
          ? `${deleted} pesan dihapus. Riwayat obrolan dikosongkan.`
          : "Riwayat obrolan sudah kosong.",
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

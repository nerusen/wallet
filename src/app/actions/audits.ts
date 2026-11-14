"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/guard";
import { todayWIB } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/server";
import type { ActionResult, DailyAudit } from "@/lib/types/database";
import { translateDbError } from "@/lib/utils";

/**
 * Toggle one of the two daily discipline checkboxes.
 *
 * `audit_date` is UNIQUE, so the row is upserted on that key — checking the
 * same day twice updates rather than duplicating.
 */
export async function toggleAuditAction(
  formData: FormData,
): Promise<ActionResult<{ audit: DailyAudit }>> {
  await requireSession();

  const rawDate = String(formData.get("audit_date") ?? "").trim();
  const auditDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayWIB();
  const field = String(formData.get("field") ?? "");
  const value = String(formData.get("value") ?? "") === "true";

  if (field !== "evening_audit_done" && field !== "monday_split_done") {
    return { ok: false, error: "Field audit tidak dikenal." };
  }

  try {
    const supabase = createServiceClient();

    const { data: existing, error: readError } = await supabase
      .from("daily_audits")
      .select("*")
      .eq("audit_date", auditDate)
      .maybeSingle();

    if (readError) throw new Error(readError.message);

    const payload = {
      audit_date: auditDate,
      evening_audit_done:
        field === "evening_audit_done" ? value : (existing?.evening_audit_done ?? false),
      monday_split_done:
        field === "monday_split_done" ? value : (existing?.monday_split_done ?? false),
      notes: existing?.notes ?? null,
    };

    const { data, error } = await supabase
      .from("daily_audits")
      .upsert(payload, { onConflict: "audit_date" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/aturan");
    revalidatePath("/dashboard");
    return {
      ok: true,
      data: { audit: data },
      message: value ? "Checklist ditandai selesai." : "Checklist dibatalkan.",
    };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

export async function saveAuditNotesAction(
  formData: FormData,
): Promise<ActionResult<undefined>> {
  await requireSession();

  const rawDate = String(formData.get("audit_date") ?? "").trim();
  const auditDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayWIB();
  const notes = String(formData.get("notes") ?? "").trim();

  try {
    const supabase = createServiceClient();

    const { data: existing, error: readError } = await supabase
      .from("daily_audits")
      .select("evening_audit_done, monday_split_done")
      .eq("audit_date", auditDate)
      .maybeSingle();

    if (readError) throw new Error(readError.message);

    const { error } = await supabase.from("daily_audits").upsert(
      {
        audit_date: auditDate,
        evening_audit_done: existing?.evening_audit_done ?? false,
        monday_split_done: existing?.monday_split_done ?? false,
        notes: notes.length > 0 ? notes : null,
      },
      { onConflict: "audit_date" },
    );

    if (error) throw new Error(error.message);

    revalidatePath("/aturan");
    return { ok: true, data: undefined, message: "Catatan audit disimpan." };
  } catch (error) {
    return { ok: false, error: translateDbError(error) };
  }
}

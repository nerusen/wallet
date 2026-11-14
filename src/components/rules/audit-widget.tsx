"use client";

import { CalendarCheck, Check, Flame, Loader2, Moon, Split } from "lucide-react";
import * as React from "react";

import { saveAuditNotesAction, toggleAuditAction } from "@/app/actions/audits";
import { Button, MotionButton } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import {
  Badge,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
} from "@/components/ui/panel";
import { EVENING_AUDIT_HOUR, MONDAY_SPLIT_HOUR } from "@/lib/constants";
import {
  addDays,
  formatDateLong,
  formatDateShort,
  hariIndonesia,
  timeWIB,
} from "@/lib/format";
import { useMounted } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import type { DailyAudit } from "@/lib/types/database";
import type { StreakResult } from "@/lib/finance";

/**
 * Daily check-in widget.
 *
 * Two checkboxes, one row per day, upserted on the UNIQUE `audit_date` key.
 * The Monday salary-split checkbox is only meaningful on Mondays, so it is
 * disabled on other days rather than silently accepting a meaningless tick.
 */
export function AuditWidget({
  todayAudit,
  streak,
  today,
  recent,
}: {
  todayAudit: DailyAudit | undefined;
  streak: StreakResult;
  today: string;
  recent: readonly DailyAudit[];
}) {
  const mounted = useMounted();
  const isMonday = hariIndonesia(today) === "Senin";

  return (
    <div className="flex flex-col gap-6">
      <div className="outline-grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ── Check-in ── */}
        <div className="bg-background">
          <Panel className="h-full border-0">
            <PanelHeader
              code="01"
              eyebrow="Check-in Harian"
              title={formatDateLong(today)}
              description="Tandai dua disiplin inti setiap hari. Streak dihitung dari audit malam yang berurutan."
              actions={
                <Badge tone="neutral">
                  {mounted ? `${timeWIB()} WIB` : "—:— WIB"}
                </Badge>
              }
            />

            <div className="divide-grid-y">
              <AuditToggle
                today={today}
                field="evening_audit_done"
                checked={todayAudit?.evening_audit_done ?? false}
                Icon={Moon}
                label={`Audit Malam ${String(EVENING_AUDIT_HOUR).padStart(2, "0")}:00 WIB`}
                description="Catat semua pengeluaran hari ini, cek saldo dompet, lalu tandai selesai."
                disabled={false}
              />
              <AuditToggle
                today={today}
                field="monday_split_done"
                checked={todayAudit?.monday_split_done ?? false}
                Icon={Split}
                label={`Pecah Gaji Senin ${String(MONDAY_SPLIT_HOUR).padStart(2, "0")}:00 WIB`}
                description={
                  isMonday
                    ? "Pecah gaji ke 5 pos: 35% / 25% / 20% / 15% / 5%."
                    : `Hanya aktif pada hari Senin. Hari ini ${hariIndonesia(today)}.`
                }
                disabled={!isMonday}
              />
            </div>

            <NotesForm today={today} initialNotes={todayAudit?.notes ?? ""} />
          </Panel>
        </div>

        {/* ── Streak ── */}
        <div className="bg-background">
          <Panel className="h-full border-0">
            <PanelHeader
              code="02"
              eyebrow="Streak Disiplin"
              title="Hari Berturut-Turut"
              description="Dihitung dari audit malam yang selesai, mundur dari hari ini."
            />
            <PanelBody className="flex flex-col gap-5">
              <div className="flex items-end gap-3">
                <Flame
                  className={cn(
                    "size-7 shrink-0",
                    streak.current > 0 ? "text-accent" : "text-muted-foreground/40",
                  )}
                />
                <span className="font-mono text-[40px] font-bold leading-none text-foreground tabular">
                  {streak.current}
                </span>
                <span className="pb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  hari
                </span>
              </div>

              <dl className="border border-border">
                {[
                  { label: "Streak Terpanjang", value: `${streak.longest} hari` },
                  { label: "Total Hari Diaudit", value: `${streak.totalAudited} hari` },
                  {
                    label: "Audit Hari Ini",
                    value: streak.todayDone ? "Selesai" : "Belum",
                  },
                  {
                    label: "Audit Terakhir",
                    value:
                      streak.lastAuditDate === null
                        ? "—"
                        : formatDateShort(streak.lastAuditDate),
                  },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-center justify-between gap-3 px-3 py-2",
                      index > 0 && "border-t border-border",
                    )}
                  >
                    <dt className="eyebrow">{item.label}</dt>
                    <dd className="font-mono text-[12px] text-foreground tabular">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* 14-day strip */}
              <div className="mt-auto">
                <span className="eyebrow">14 Hari Terakhir</span>
                <div className="mt-3 flex gap-1">
                  {Array.from({ length: 14 }, (_, i) => {
                    const date = addDays(today, -(13 - i));
                    const audit = recent.find((a) => a.audit_date === date);
                    const done = audit?.evening_audit_done ?? false;

                    return (
                      <span
                        key={date}
                        title={`${formatDateShort(date)} — ${done ? "selesai" : "belum"}`}
                        className={cn(
                          "h-6 flex-1 border",
                          done
                            ? "border-accent bg-accent"
                            : "border-border bg-surface",
                        )}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="font-mono text-[9px] text-muted-foreground tabular">
                    {formatDateShort(addDays(today, -13))}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground tabular">
                    {formatDateShort(today)}
                  </span>
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AuditToggle({
  today,
  field,
  checked,
  Icon,
  label,
  description,
  disabled,
}: {
  today: string;
  field: "evening_audit_done" | "monday_split_done";
  checked: boolean;
  Icon: typeof Moon;
  label: string;
  description: string;
  disabled: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onToggle() {
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("audit_date", today);
    formData.set("field", field);
    formData.set("value", checked ? "false" : "true");

    const result = await toggleAuditAction(formData);
    setPending(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <MotionButton
        type="button"
        variant={checked ? "accent" : "outline"}
        size="icon-sm"
        disabled={pending || disabled}
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={label}
        className="mt-0.5 shrink-0"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : checked ? (
          <Check className="size-3.5" />
        ) : (
          <Icon className="size-3.5" />
        )}
      </MotionButton>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] font-medium",
            disabled ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {label}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </p>
        {error !== null && (
          <p role="alert" className="mt-1.5 font-mono text-[10px] text-danger">
            {error}
          </p>
        )}
      </div>

      <Badge tone={checked ? "success" : disabled ? "neutral" : "warning"}>
        {checked ? "Selesai" : disabled ? "N/A" : "Belum"}
      </Badge>
    </div>
  );
}

function NotesForm({
  today,
  initialNotes,
}: {
  today: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = React.useState(initialNotes);
  const [pending, setPending] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => setNotes(initialNotes), [initialNotes]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice(null);

    const result = await saveAuditNotesAction(new FormData(event.currentTarget));
    setPending(false);
    setNotice(result.ok ? (result.message ?? "Tersimpan.") : result.error);
  }

  const dirty = notes !== initialNotes;

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="audit_date" value={today} />

      <PanelBody>
        <Field label="Catatan Audit Hari Ini" htmlFor="audit-notes">
          <Textarea
            id="audit-notes"
            name="notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Apa yang berjalan baik hari ini? Apa yang perlu diperbaiki besok?"
          />
        </Field>
        {notice !== null && (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">{notice}</p>
        )}
      </PanelBody>

      <PanelFooter>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          <CalendarCheck className="size-3" />
          {formatDateShort(today)}
        </span>
        <span className="flex gap-2">
          {/* Adjacent-button rule: Reset monochrome, Simpan accent. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!dirty || pending}
            onClick={() => setNotes(initialNotes)}
          >
            Reset
          </Button>
          <MotionButton
            type="submit"
            variant="accent"
            size="sm"
            disabled={pending || !dirty}
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Menyimpan
              </>
            ) : (
              "Simpan Catatan"
            )}
          </MotionButton>
        </span>
      </PanelFooter>
    </form>
  );
}

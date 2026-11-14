"use client";

import { Download, FileUp, Loader2 } from "lucide-react";
import * as React from "react";

import {
  exportTransactionsCsvAction,
  importTransactionsCsvAction,
} from "@/app/actions/csv";
import { Button, MotionButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Panel, PanelBody, PanelFooter, PanelHeader } from "@/components/ui/panel";
import {
  SYSTEM_HORIZON_DATE,
  SYSTEM_START_DATE,
  type ImportReport,
} from "@/lib/constants";
import type { TxType } from "@/lib/types/database";

/**
 * CSV import + export.
 *
 * Export runs as a Server Action that returns the CSV string; the browser then
 * builds the Blob and triggers the download. That keeps the action pure (no
 * filesystem, no streaming response) and works identically on Vercel.
 */
export function CsvPanel({ today }: { today: string }) {
  return (
    <div className="outline-grid grid-cols-1 xl:grid-cols-2">
      <div className="bg-background">
        <ImportCard />
      </div>
      <div className="bg-background">
        <ExportCard today={today} />
      </div>
    </div>
  );
}

function ImportCard() {
  const [pending, setPending] = React.useState(false);
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setReport(null);

    const result = await importTransactionsCsvAction(new FormData(event.currentTarget));
    setPending(false);

    if (result.ok) {
      setReport(result.data);
      formRef.current?.reset();
      setFileName(null);
    } else {
      setError(result.error);
    }
  }

  return (
    <Panel className="h-full border-0">
      <PanelHeader
        code="01"
        eyebrow="Importer"
        title="Impor CSV ke Supabase"
        description="Unggah data_keuangan_nelsen_2026_2027.csv atau file hasil ekspor sistem ini. Dompet boleh ditulis sebagai nama atau UUID."
      />

      <form ref={formRef} onSubmit={onSubmit}>
        <PanelBody className="flex flex-col gap-4">
          <Field label="Berkas CSV" htmlFor="csv-file" hint="maks 4 MB">
            <Input
              id="csv-file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              onChange={(event) =>
                setFileName(event.target.files?.[0]?.name ?? null)
              }
            />
          </Field>

          {fileName !== null && (
            <p className="font-mono text-[11px] text-muted-foreground">
              Terpilih: <span className="text-foreground">{fileName}</span>
            </p>
          )}

          <div className="border border-border bg-surface px-3 py-2.5">
            <p className="eyebrow">Kolom Yang Dikenali</p>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              tanggal · tx_type · kategori · barang_keperluan · nominal · dompet ·
              dompet_tujuan · is_frozen_freelance · catatan
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Kolom <span className="font-mono text-foreground">hari</span>,{" "}
              <span className="font-mono text-foreground">minggu_ke</span>, dan{" "}
              <span className="font-mono text-foreground">bulan</span> dihitung
              otomatis bila kosong. Format tanggal menerima{" "}
              <span className="font-mono">YYYY-MM-DD</span> maupun{" "}
              <span className="font-mono">DD/MM/YYYY</span>.
            </p>
          </div>

          {error !== null && (
            <p
              role="alert"
              className="border border-danger bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-danger"
            >
              {error}
            </p>
          )}

          {report !== null && (
            <div className="border border-accent bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <Badge tone="accent">{report.inserted} masuk</Badge>
                <Badge tone="neutral">{report.total} dibaca</Badge>
                {report.skipped > 0 && (
                  <Badge tone="warning">{report.skipped} dilewati</Badge>
                )}
              </div>
              {report.issues.length > 0 && (
                <ul className="max-h-40 overflow-y-auto px-3 py-2">
                  {report.issues.map((issue, index) => (
                    <li
                      key={index}
                      className="font-mono text-[10px] leading-relaxed text-warning"
                    >
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </PanelBody>

        <PanelFooter>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Saldo dihitung ulang setelah impor
          </span>
          <MotionButton type="submit" variant="accent" size="sm" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Mengimpor
              </>
            ) : (
              <>
                <FileUp className="size-3.5" />
                Impor CSV
              </>
            )}
          </MotionButton>
        </PanelFooter>
      </form>
    </Panel>
  );
}

function ExportCard({ today }: { today: string }) {
  const [from, setFrom] = React.useState(SYSTEM_START_DATE);
  const [to, setTo] = React.useState(today);
  const [txType, setTxType] = React.useState<TxType | "all">("all");
  const [pending, setPending] = React.useState(false);
  const [notice, setNotice] = React.useState<
    { tone: "ok" | "error"; message: string } | null
  >(null);

  async function onExport(scope: "range" | "all") {
    setPending(true);
    setNotice(null);

    const result = await exportTransactionsCsvAction(
      scope === "all"
        ? { txType: "all" }
        : { from, to, txType },
    );

    setPending(false);

    if (!result.ok) {
      setNotice({ tone: "error", message: result.error });
      return;
    }

    // Build the download client-side from the returned payload.
    const blob = new Blob([result.data.csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.data.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotice({
      tone: "ok",
      message: `${result.data.rows} baris diunduh sebagai ${result.data.filename}.`,
    });
  }

  return (
    <Panel className="h-full border-0">
      <PanelHeader
        code="02"
        eyebrow="Exporter"
        title="Unduh Transaksi sebagai CSV"
        description="Ekspor penuh atau terfilter. Nama dompet ikut diekspor sehingga file bisa langsung diimpor ulang."
      />

      <PanelBody className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Dari Tanggal" htmlFor="ex-from">
            <Input
              id="ex-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="Sampai Tanggal" htmlFor="ex-to">
            <Input
              id="ex-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Jenis Transaksi" htmlFor="ex-type">
          <Select
            id="ex-type"
            value={txType}
            onChange={(event) => setTxType(event.target.value as TxType | "all")}
          >
            <option value="all">Semua jenis</option>
            <option value="income_salary">Pemasukan Gaji</option>
            <option value="income_freelance">Pemasukan Freelance</option>
            <option value="expense">Pengeluaran</option>
            <option value="transfer">Transfer</option>
          </Select>
        </Field>

        <div className="flex flex-wrap gap-2">
          {[
            { label: "Sejak Awal", from: SYSTEM_START_DATE, to: today },
            { label: "Horizon 30 Jun 2027", from: SYSTEM_START_DATE, to: SYSTEM_HORIZON_DATE },
            { label: "Bulan Ini", from: `${today.slice(0, 7)}-01`, to: today },
          ].map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => {
                setFrom(preset.from);
                setTo(preset.to);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {notice !== null && (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={`border bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed ${
              notice.tone === "error"
                ? "border-danger text-danger"
                : "border-accent text-accent"
            }`}
          >
            {notice.message}
          </p>
        )}
      </PanelBody>

      <PanelFooter>
        {/* Adjacent-button rule: only one accent fill. */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => onExport("all")}
        >
          Unduh Semua
        </Button>
        <MotionButton
          type="button"
          variant="accent"
          size="sm"
          disabled={pending}
          onClick={() => onExport("range")}
        >
          {pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Menyiapkan
            </>
          ) : (
            <>
              <Download className="size-3.5" />
              Unduh Terfilter
            </>
          )}
        </MotionButton>
      </PanelFooter>
    </Panel>
  );
}

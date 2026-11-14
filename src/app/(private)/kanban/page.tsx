import type { Metadata } from "next";

import { KanbanBoard } from "@/components/kanban/kanban-board";
import { LoadError, PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { RevealOnScroll } from "@/components/ui/motion";
import { KANBAN_COLUMNS, QUARANTINE_HOURS } from "@/lib/constants";
import { formatRupiah } from "@/lib/format";
import { fetchSnapshot } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: "Kanban & Wishlist",
  description: "Pipeline proyek freelance dan karantina wishlist 48 jam.",
};

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const snapshot = await fetchSnapshot({
    wallets: false,
    transactions: false,
    tasks: true,
  });

  const tasks = snapshot.tasks;
  const wishlist = tasks.filter((t) => t.task_type === "wishlist_48h");
  const quarantined = wishlist.filter(
    (t) => t.unlock_at !== null && new Date(t.unlock_at).getTime() > Date.now(),
  );
  const freelanceProjects = tasks.filter((t) => t.task_type === "freelance_project");
  const pipelineValue = freelanceProjects
    .filter((t) => t.status !== "done")
    .reduce((acc, t) => acc + t.amount, 0);
  const quarantinedValue = quarantined.reduce((acc, t) => acc + t.amount, 0);

  return (
    <>
      <PageHeader
        eyebrow="Modul 04 · Board"
        title="Kanban & Wishlist 48 Jam"
        description={`Empat kolom untuk mengalirkan proyek freelance dan tugas karier. Setiap keinginan belanja non-esensial wajib melewati karantina ${QUARANTINE_HOURS} jam sebelum boleh dibeli.`}
        meta={[
          { label: "Total Kartu", value: String(tasks.length) },
          { label: "Nilai Pipeline", value: formatRupiah(pipelineValue) },
          { label: "Wishlist Dikarantina", value: String(quarantined.length) },
          { label: "Nilai Tertahan", value: formatRupiah(quarantinedValue) },
        ]}
      />

      <PageBody>
        {snapshot.error !== null && <LoadError message={snapshot.error} />}

        <KanbanBoard tasks={tasks} />

        <RevealOnScroll>
          <Panel>
            <PanelHeader
              code="05"
              eyebrow="Cara Kerja Board"
              title="Aturan Alur Kartu"
            />
            <div className="outline-grid grid-cols-1 border-t-0 sm:grid-cols-2 lg:grid-cols-4">
              {KANBAN_COLUMNS.map((column) => (
                <div key={column.status} className="bg-background p-4">
                  <span className="eyebrow eyebrow-accent">{column.code}</span>
                  <h4 className="mt-2.5 text-[13px] font-semibold text-foreground">
                    {column.label}
                  </h4>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                    {COLUMN_NOTES[column.status]}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </RevealOnScroll>
      </PageBody>
    </>
  );
}

const COLUMN_NOTES: Record<string, string> = {
  backlog:
    "Pintu masuk semua kartu. Wishlist 48H selalu mulai di sini dengan hitungan mundur aktif.",
  in_progress:
    "Pekerjaan yang sedang dikerjakan. Jaga jumlahnya tetap sedikit agar fokus tidak pecah.",
  review:
    "Menunggu konfirmasi klien, pembayaran, atau keputusan akhir pembelian.",
  done: "Selesai atau lunas. Wishlist hanya boleh masuk setelah 48 jam penuh terlewati — dipaksakan oleh trigger database.",
};

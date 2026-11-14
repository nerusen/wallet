import type { LucideIcon } from "lucide-react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BookOpen,
  KanbanSquare,
  LayoutGrid,
  ScrollText,
  Wallet as WalletIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** Mono register code shown in the sidebar rail. */
  code: string;
  Icon: LucideIcon;
  description: string;
}

/** The 7 private routes, in sidebar order. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    code: "01",
    Icon: LayoutGrid,
    description: "Ringkasan KPI, grafik, dan saldo dompet.",
  },
  {
    href: "/pemasukan",
    label: "Pemasukan",
    code: "02",
    Icon: ArrowUpCircle,
    description: "Gaji, part-time, dan proyek freelance.",
  },
  {
    href: "/pengeluaran",
    label: "Pengeluaran",
    code: "03",
    Icon: ArrowDownCircle,
    description: "Catatan belanja harian dan kuota rokok.",
  },
  {
    href: "/kanban",
    label: "Kanban & Wishlist",
    code: "04",
    Icon: KanbanSquare,
    description: "Pipeline proyek dan karantina 48 jam.",
  },
  {
    href: "/dompet",
    label: "Dompet & Brankas",
    code: "05",
    Icon: WalletIcon,
    description: "Maksimal 5 dompet, transfer antar kantong.",
  },
  {
    href: "/laporan",
    label: "Laporan & CSV",
    code: "06",
    Icon: ScrollText,
    description: "Buku besar, rollup, impor & ekspor CSV.",
  },
  {
    href: "/aturan",
    label: "SOP & Audit",
    code: "07",
    Icon: BookOpen,
    description: "Audit malam 21:00 dan streak disiplin.",
  },
] as const;

export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

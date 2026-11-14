import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/panel";

export default function NotFound() {
  return (
    <main className="min-h-dvh">
      <div className="page-frame flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-md border border-border bg-background p-8">
          <Eyebrow accent rule>
            Error 404
          </Eyebrow>
          <h1 className="mt-6 text-[28px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
            Halaman tidak ditemukan.
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Rute yang Anda buka tidak terdaftar di sistem ini. Periksa kembali URL-nya
            atau kembali ke titik awal.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button asChild variant="accent" size="sm">
              <Link href="/dashboard">Ke Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/">Halaman Utama</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

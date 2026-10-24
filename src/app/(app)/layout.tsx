import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AkunSaya } from "@/components/akun-saya";
import { EdisiData, EdisiDataKosong } from "@/components/edisi-data";
import { Nav } from "@/components/nav";
import { SidebarToggle } from "@/components/sidebar-toggle";

// Kerangka aplikasi (sidebar) untuk semua halaman setelah login. Halaman /login berada di luar grup ini.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="z-30 bg-brand-950 px-3 py-3 text-brand-100 transition-[width] duration-200 md:sticky md:top-0 md:flex md:h-screen md:w-[272px] md:shrink-0 md:flex-col md:py-5 md:collapsed:w-[72px]">
        <div className="mb-3 flex items-center justify-between gap-2 px-2 md:mb-8 md:collapsed:flex-col md:collapsed:px-0">
          <Link href="/" className="flex min-w-0 flex-col gap-1.5 rounded-md" title="Kamus Kompetensi Bank Sultra">
            <Image
              src="/brand/logo-bank-sultra-putih.png"
              alt="Bank Sultra"
              width={399}
              height={101}
              priority
              className="h-9 w-auto md:collapsed:hidden"
            />
            {/* sidebar diciutkan: hanya swoosh emas dari logo */}
            <Image src="/brand/swoosh.png" alt="Bank Sultra" width={180} height={76} className="hidden h-6 w-auto md:collapsed:block" />
            <span className="font-heading text-xs font-medium tracking-wide text-brand-300 md:collapsed:hidden">Kamus Kompetensi</span>
          </Link>
          <SidebarToggle />
        </div>
        <div className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300/70 md:block md:collapsed:hidden">Menu</div>
        <Nav />
        <div className="mt-3 space-y-3 md:mt-auto">
          {/* teks edisi dibaca dari tabel pengaturan (diubah admin), jadi di-stream di balik Suspense */}
          <Suspense fallback={<EdisiDataKosong />}>
            <EdisiData />
          </Suspense>
          {/* nama pengguna dibaca dari cookie (data per permintaan), jadi di-stream di balik Suspense */}
          <Suspense fallback={<div className="h-10" />}>
            <AkunSaya />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}

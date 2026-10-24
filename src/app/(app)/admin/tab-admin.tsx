"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const TAB = [
  { href: "/admin/pengguna", label: "Pengguna" },
  { href: "/admin/pengaturan", label: "Pengaturan" },
] as const;

// Sama seperti Nav: pathname adalah data runtime, jadi tab aktif di-stream di balik Suspense.
export function TabAdmin() {
  return (
    <Suspense fallback={<Daftar path={null} />}>
      <TabAktif />
    </Suspense>
  );
}

function TabAktif() {
  return <Daftar path={usePathname()} />;
}

function Daftar({ path }: { path: string | null }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Bagian admin">
      {TAB.map((t) => {
        const aktif = path?.startsWith(t.href) ?? false;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={aktif ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              aktif ? "border-brand-700 text-brand-800" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

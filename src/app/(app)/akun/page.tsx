import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/editors";
import { DetailSkeleton } from "@/components/skeleton";
import { Card, PageHeader } from "@/components/ui";
import { wajibLogin } from "@/lib/auth";
import { bacaPengaturan } from "@/lib/pengaturan";
import { gantiPasswordSaya } from "@/lib/pengguna-actions";
import { PERAN_LABEL, PERAN_PENJELASAN } from "@/lib/peran";

export const metadata: Metadata = { title: "Akun Saya" };

export default function Page() {
  return (
    <>
      <PageHeader title="Akun Saya" desc="Peran akun dan penggantian password." />
      <Suspense fallback={<DetailSkeleton label="Memuat akun" />}>
        <Isi />
      </Suspense>
    </>
  );
}

async function Isi() {
  const [s, { panjang_password_min: min }] = await Promise.all([wajibLogin(), bacaPengaturan()]);
  return (
    <div className="grid grid-cols-1 max-w-4xl gap-6 lg:grid-cols-2">
      <Card title="Akun">
        <dl className="space-y-3 p-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama</dt>
            <dd className="text-slate-900">{s.nama}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</dt>
            <dd className="font-mono text-slate-900">{s.username}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Peran</dt>
            <dd className="text-slate-900">{PERAN_LABEL[s.peran]}</dd>
            <dd className="text-slate-600">{PERAN_PENJELASAN[s.peran]}</dd>
          </div>
        </dl>
      </Card>
      <Card title="Ganti password">
        <ActionForm action={gantiPasswordSaya} submit="Ganti password" className="p-4">
          <label className="field-label">
            Password saat ini
            <input type="password" name="lama" required autoComplete="current-password" className="field" />
          </label>
          <label className="field-label">
            Password baru (minimal {min} karakter)
            <input type="password" name="baru" required minLength={min} autoComplete="new-password" className="field" />
          </label>
          <label className="field-label">
            Ulangi password baru
            <input type="password" name="ulang" required minLength={min} autoComplete="new-password" className="field" />
          </label>
        </ActionForm>
      </Card>
    </div>
  );
}

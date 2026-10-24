import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/editors";
import { DetailSkeleton } from "@/components/skeleton";
import { Card } from "@/components/ui";
import { wajibLogin } from "@/lib/auth";
import { BATAS_ANGKA, bacaPengaturan } from "@/lib/pengaturan";
import { simpanKeamanan, simpanTampilan } from "@/lib/pengaturan-actions";
import { bolehKelolaAkun } from "@/lib/peran";
import { admin } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: "Pengaturan" };

const PENJELASAN: Record<keyof typeof BATAS_ANGKA, string> = {
  batas_gagal_login: "Percobaan login salah berturut-turut sebelum akun dikunci sementara.",
  lama_kunci_menit: "Lama akun tidak bisa login setelah mencapai batas gagal. Admin juga bisa membukanya lewat Reset password.",
  lama_sesi_jam: "Masa berlaku login biasa. Berlaku untuk login berikutnya.",
  lama_ingat_hari: "Masa berlaku login bila \"Ingat saya\" dicentang. Berlaku untuk login berikutnya.",
  panjang_password_min: "Syarat panjang saat pengguna mengganti password di Akun saya.",
};

export default function Page() {
  return (
    <Suspense fallback={<DetailSkeleton label="Memuat pengaturan" />}>
      <Isi />
    </Suspense>
  );
}

async function Isi() {
  const saya = await wajibLogin();
  if (!bolehKelolaAkun(saya.peran)) redirect("/");
  const p = await bacaPengaturan();
  const pengubah = p.diubah_oleh ? (await admin().from("pengguna").select("nama").eq("id", p.diubah_oleh).maybeSingle()).data?.nama : null;

  return (
    <div className="max-w-4xl space-y-6">
      {p.updated_at && (
        <p className="text-xs text-slate-500">
          Terakhir diubah {new Date(p.updated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          {pengubah && ` oleh ${pengubah}`}.
        </p>
      )}

      <Card title="Tampilan">
        <ActionForm action={simpanTampilan} className="p-4">
          <p className="text-sm text-slate-600">Kotak keterangan edisi data di bawah menu sidebar, terlihat oleh semua pengguna.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="field-label">
              Judul edisi
              <input name="edisi_judul" required maxLength={80} defaultValue={p.edisi_judul} className="field" />
            </label>
            <label className="field-label">
              Keterangan
              <input name="edisi_keterangan" maxLength={160} defaultValue={p.edisi_keterangan} className="field" />
            </label>
          </div>
        </ActionForm>
      </Card>

      <Card title="Keamanan login">
        <ActionForm action={simpanKeamanan} className="p-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {(Object.keys(BATAS_ANGKA) as (keyof typeof BATAS_ANGKA)[]).map((k) => (
              <label key={k} className="field-label">
                {BATAS_ANGKA[k].label}
                <input type="number" name={k} required min={BATAS_ANGKA[k].min} max={BATAS_ANGKA[k].max} step={1} defaultValue={p[k]} className="field" />
                <span className="text-xs font-normal normal-case tracking-normal text-slate-500">
                  {PENJELASAN[k]} Rentang {BATAS_ANGKA[k].min}–{BATAS_ANGKA[k].max}.
                </span>
              </label>
            ))}
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}

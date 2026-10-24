import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/editors";
import { ListSkeleton } from "@/components/skeleton";
import { Card, Empty, PageHeader } from "@/components/ui";
import { tandaiSelesaiMassal } from "@/lib/actions";
import { wajibLogin } from "@/lib/auth";
import { JENJANG_LABEL } from "@/lib/labels";
import { bolehEdit } from "@/lib/peran";
import { must, supabase } from "@/lib/supabase";
import { DaftarPilih, type Baris, type Grup } from "./daftar-pilih";

export const metadata: Metadata = { title: "Tandai Selesai Massal" };

type Search = { per?: string };
const PER = { nama: "Nama jabatan", unit: "Divisi / kantor" } as const;

export default function Page(props: PageProps<"/review/selesai">) {
  return (
    <>
      <PageHeader
        title="Tandai Selesai Massal"
        desc="Tandai banyak jabatan draf sebagai selesai sekaligus. Jabatan bernama sama di unit berbeda dikelompokkan agar bisa diperiksa sekali; tiap penandaan tetap tercatat di riwayat jabatannya."
      >
        <Link href="/review" className="btn-secondary">
          ← Progres Review
        </Link>
      </PageHeader>
      <Suspense fallback={<ListSkeleton label="Memuat jabatan draf" fields={1} columns={1} rows={8} />}>
        <Isi searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function Isi({ searchParams }: { searchParams: Promise<Search> }) {
  const [saya, { per: perParam }] = await Promise.all([wajibLogin(), searchParams]);
  if (!bolehEdit(saya.peran)) redirect("/review");
  const per: keyof typeof PER = perParam === "unit" ? "unit" : "nama";

  const antre = await supabase.from("v_review_jabatan").select("jabatan_id, kode, nama, jenjang, unit_induk_nama, unit_nama, peninjau").eq("status", "draf").order("urutan").then(must);
  const ids = antre.map((j) => j.jabatan_id!);
  const kodes = antre.map((j) => j.kode!);
  const [profil, cekAtasan, cekKamus] = ids.length
    ? await Promise.all([
        supabase.from("v_profil_jabatan").select("id, jumlah_kompetensi, profil").in("id", ids).then(must),
        supabase.from("v_cek_level_atasan").select("jabatan_kode").in("jabatan_kode", kodes).then(must),
        supabase.from("v_cek_level_kamus").select("jabatan_kode").in("jabatan_kode", kodes).then(must),
      ])
    : [[], [], []];

  const profilDari = new Map(profil.map((p) => [p.id, p]));
  const peringatan = new Map<string, number>();
  for (const c of [...cekAtasan, ...cekKamus]) peringatan.set(c.jabatan_kode!, (peringatan.get(c.jabatan_kode!) ?? 0) + 1);

  const grupMap = new Map<string, { judul: string; items: Baris[]; tanda: Set<string> }>();
  for (const j of antre) {
    const kunci = per === "unit" ? (j.unit_induk_nama ?? "-") : j.nama!.trim().toLowerCase();
    const p = profilDari.get(j.jabatan_id!);
    const g = grupMap.get(kunci) ?? { judul: per === "unit" ? (j.unit_induk_nama ?? "-") : j.nama!, items: [], tanda: new Set<string>() };
    g.items.push({
      id: j.jabatan_id!,
      kode: j.kode!,
      nama: j.nama!,
      unit: per === "unit" ? (j.unit_nama ?? "-") : (j.unit_induk_nama ?? "-"),
      jenjang: JENJANG_LABEL[j.jenjang!] ?? `Jenjang ${j.jenjang}`,
      jumlah: p?.jumlah_kompetensi ?? 0,
      peringatan: peringatan.get(j.kode!) ?? 0,
      peninjau: j.peninjau,
    });
    g.tanda.add((p?.profil ?? []).join("|"));
    grupMap.set(kunci, g);
  }
  // grup terbesar dulu: satu kali periksa menuntaskan paling banyak jabatan
  const grup: Grup[] = [...grupMap]
    .map(([kunci, g]) => ({ kunci, judul: g.judul, items: g.items, identik: per === "nama" && g.items.length > 1 ? g.tanda.size === 1 : null }))
    .sort((a, b) => b.items.length - a.items.length || a.judul.localeCompare(b.judul, "id"));

  if (!antre.length) {
    return (
      <Empty>
        Semua jabatan sudah ditandai selesai.{" "}
        <Link href="/review" className="link">
          Kembali ke Progres Review
        </Link>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Kelompokkan">
        <span className="text-slate-600">Kelompokkan per:</span>
        {(Object.keys(PER) as (keyof typeof PER)[]).map((k) => (
          <Link
            key={k}
            href={k === "nama" ? "/review/selesai" : `/review/selesai?per=${k}`}
            aria-current={per === k ? "page" : undefined}
            className={`rounded-full px-3 py-1 ring-1 ${per === k ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}
          >
            {PER[k]}
          </Link>
        ))}
      </nav>

      <ActionForm action={tandaiSelesaiMassal} submit="Tandai selesai">
        <DaftarPilih key={per} grup={grup} />
        <Card>
          <div className="space-y-3 p-4">
            <label className="field-label">
              Catatan (opsional, ikut tercatat di tiap jabatan)
              <input name="catatan" maxLength={300} className="field" placeholder="mis. final setelah pembahasan dengan HC 24 Okt 2026" />
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" name="yakin" required className="mt-0.5 accent-brand-700" />
              Saya sudah memeriksa pemetaan jabatan yang dicentang dan menyatakannya final untuk diserahkan ke Divisi HC.
            </label>
            <p className="text-xs text-slate-500">Tercatat atas nama {saya.nama}. Jabatan yang statusnya berubah sejak halaman dibuka akan dilewati.</p>
          </div>
        </Card>
      </ActionForm>
    </div>
  );
}

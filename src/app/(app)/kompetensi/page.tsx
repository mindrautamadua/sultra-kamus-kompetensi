import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PdfLink } from "@/components/ui";
import { ListSkeleton } from "@/components/skeleton";
import { must, supabase } from "@/lib/supabase";
import { DaftarKompetensi, type Fokus } from "./daftar";

export const metadata: Metadata = { title: "Kamus Kompetensi" };

type Search = { kategori?: string; bidang?: string; fokus?: string; q?: string };

const PAGE = 1000; // = max_rows PostgREST di supabase/config.toml

export default function Page(props: PageProps<"/kompetensi">) {
  return (
    <>
      <PageHeader title="Kamus Kompetensi" desc="Seluruh kompetensi dari dokumen kamus beserta seberapa banyak dipakai jabatan. Klik kompetensi untuk melihat definisi, 5 level, dan indikator perilaku.">
        <PdfLink href="/dokumen/kamus/semua" className="btn-secondary">
          Seluruh kamus (PDF)
        </PdfLink>
      </PageHeader>
      <Suspense fallback={<ListSkeleton label="Memuat kamus kompetensi" fields={3} rows={5} />}>
        <List searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function List({ searchParams }: { searchParams: Promise<Search> }) {
  const { kategori = "", bidang = "", fokus = "", q = "" } = await searchParams;

  const [rows, bidangList, pakai, totalJabatan] = await Promise.all([
    supabase
      .from("v_kompetensi")
      .select("kode, nama, definisi, status, tanda_c, catatan, kategori, bidang_kode, bidang_nama, jumlah_indikator")
      .order("urutan")
      .then(must),
    supabase.from("bidang_kompetensi").select("kode, nama, kategori").order("urutan").then(must),
    hitungPemakaian(),
    supabase
      .from("v_jabatan")
      .select("id", { count: "exact", head: true })
      .gt("jenjang", 0)
      .then((r) => r.count ?? 0),
  ]);

  const items = rows.map((r) => ({
    kode: r.kode!,
    nama: r.nama!,
    definisi: r.definisi,
    status: r.status ?? "lengkap",
    tanda_c: !!r.tanda_c,
    catatan: r.catatan ?? [],
    kategori: r.kategori ?? "teknis",
    bidang_kode: r.bidang_kode!,
    bidang_nama: r.bidang_nama!,
    jumlah_indikator: r.jumlah_indikator ?? 0,
    jumlah_jabatan: pakai.per.get(r.kode!)?.reduce((a, b) => a + b, 0) ?? 0,
    level: pakai.per.get(r.kode!) ?? [0, 0, 0, 0, 0],
  }));

  return (
    <DaftarKompetensi
      items={items}
      bidang={bidangList}
      totalJabatan={totalJabatan}
      usulan={pakai.usulan}
      awal={{ q, kategori, bidang, fokus: (["perlu", "belum_dipetakan"].includes(fokus) ? fokus : "") as Fokus }}
    />
  );
}

/** Sebaran level target tiap kompetensi (indeks 0 = level 1) dan jumlah pemetaan yang masih usulan otomatis. */
async function hitungPemakaian() {
  const per = new Map<string, number[]>();
  let usulan = 0;
  for (let from = 0; ; from += PAGE) {
    const rows = await supabase
      .from("v_jabatan_kompetensi")
      .select("kompetensi_kode, level_target, sumber")
      .order("id")
      .range(from, from + PAGE - 1)
      .then(must);
    for (const r of rows) {
      const lv = per.get(r.kompetensi_kode!) ?? [0, 0, 0, 0, 0];
      const i = Math.min(Math.max((r.level_target ?? 1) - 1, 0), 4);
      lv[i]++;
      per.set(r.kompetensi_kode!, lv);
      if (r.sumber === "usulan") usulan++;
    }
    if (rows.length < PAGE) break;
  }
  return { per, usulan };
}

import "server-only";
import { must, supabase } from "@/lib/supabase";

// Data Universe Kompetensi: dua pohon (kamus: kategori > bidang > kompetensi; organisasi: unit kerja > jabatan)
// yang disilangkan oleh pemetaan jabatan_kompetensi. Dikirim utuh ke client sekali, pohonnya dibangun di sana.

export type UBidang = { kode: string; nama: string; kategori: string };
export type UKompetensi = { id: number; kode: string; nama: string; kategori: string; bidang: string; status: string; jabatan: number };
export type UUnit = { id: number; kode: string; nama: string; jenis: string; parent: number | null };
export type UJabatan = { id: number; kode: string; nama: string; unit: number; jenjang: number };
export type UniverseData = {
  bidang: UBidang[];
  kompetensi: UKompetensi[];
  unit: UUnit[];
  jabatan: UJabatan[];
  // [jabatan_id, kompetensi_id, level_target]
  relasi: [number, number, number][];
};

const PAGE = 1000; // = max_rows PostgREST di supabase/config.toml

export async function loadUniverse(): Promise<UniverseData> {
  const [bidang, kompetensi, unit, jabatan, relasi] = await Promise.all([
    supabase.from("bidang_kompetensi").select("kode, nama, kategori").order("urutan").then(must),
    supabase
      .from("v_kompetensi_pemakaian")
      .select("id, kode, nama, kategori, bidang_kode, status, jumlah_jabatan")
      .neq("status", "dihapus")
      .order("bidang_urutan")
      .order("urutan")
      .then(must),
    supabase.from("unit_kerja").select("id, kode, nama, jenis, parent_id").order("urutan").then(must),
    supabase.from("jabatan").select("id, kode, nama, unit_kerja_id, jenjang").order("urutan").then(must),
    loadRelasi(),
  ]);
  return {
    bidang,
    kompetensi: kompetensi.map((k) => ({
      id: k.id!,
      kode: k.kode!,
      nama: k.nama!,
      kategori: k.kategori!,
      bidang: k.bidang_kode!,
      status: k.status!,
      jabatan: k.jumlah_jabatan ?? 0,
    })),
    unit: unit.map((u) => ({ id: u.id, kode: u.kode, nama: u.nama, jenis: u.jenis, parent: u.parent_id })),
    jabatan: jabatan.map((j) => ({ id: j.id, kode: j.kode, nama: j.nama, unit: j.unit_kerja_id, jenjang: j.jenjang })),
    relasi,
  };
}

async function loadRelasi(): Promise<[number, number, number][]> {
  const rows: [number, number, number][] = [];
  for (let from = 0; ; from += PAGE) {
    // order wajib: tanpa urutan tetap, halaman Range bisa saling tumpang tindih
    const page = await supabase
      .from("jabatan_kompetensi")
      .select("jabatan_id, kompetensi_id, level_target")
      .order("id")
      .range(from, from + PAGE - 1)
      .then(must);
    rows.push(...page.map((r) => [r.jabatan_id, r.kompetensi_id, r.level_target] as [number, number, number]));
    if (page.length < PAGE) break;
  }
  return rows;
}

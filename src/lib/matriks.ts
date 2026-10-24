import { must, supabase } from "@/lib/supabase";

export type MatriksJabatan = { id: number; kode: string; nama: string; unit_nama: string; unit_induk_nama: string; jenjang: number };
export type MatriksKompetensi = { kode: string; nama: string; kategori: string };
export type Matriks = {
  jabatan: MatriksJabatan[];
  kompetensi: MatriksKompetensi[];
  // `${jabatan_id}|${kompetensi_kode}` -> level target
  level: Map<string, number>;
  usulan: boolean;
};

const URUT_KATEGORI = ["inti", "kepemimpinan", "teknis"];
const PAGE = 1000; // = max_rows PostgREST di supabase/config.toml

// Direksi (jenjang 0) tidak punya jobdesk & pemetaan, jadi tidak ikut matriks.
const jabatanQuery = () =>
  supabase.from("v_jabatan").select("id, kode, nama, unit_nama, unit_induk_nama, jenjang").gt("jenjang", 0).order("urutan");

/** Daftar divisi/kantor (unit induk) sesuai urutan struktur. */
export async function loadUnits(): Promise<string[]> {
  const rows = await supabase.from("v_jabatan").select("unit_induk_nama").gt("jenjang", 0).order("urutan").then(must);
  return [...new Set(rows.map((j) => j.unit_induk_nama ?? ""))];
}

/** Jabatan x kompetensi untuk satu divisi/kantor (unit induk) atau semua bila `unit` kosong; `q` menyaring nama jabatan / unit kerja. */
export async function loadMatriks(unit: string, kategori: string, q = ""): Promise<Matriks> {
  let jq = jabatanQuery();
  if (unit) jq = jq.eq("unit_induk_nama", unit);
  // buang karakter yang bermakna di dalam filter or() PostgREST
  const term = q.replace(/[%,()*]/g, " ").trim();
  if (term) jq = jq.or(`nama.ilike.%${term}%,unit_nama.ilike.%${term}%`);
  const jabatan = (await jq.then(must)) as MatriksJabatan[];

  const ids = new Set(jabatan.map((j) => j.id));
  const rows: { jabatan_id: number | null; kompetensi_kode: string | null; kompetensi_nama: string | null; kategori: string | null; level_target: number | null; sumber: string | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("v_jabatan_kompetensi")
      .select("jabatan_id, kompetensi_kode, kompetensi_nama, kategori, level_target, sumber")
      .order("id")
      .range(from, from + PAGE - 1);
    if (unit || term) query = query.in("jabatan_id", [...ids]);
    if (kategori) query = query.eq("kategori", kategori);
    const page = await query.then(must);
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  const kompetensi = new Map<string, MatriksKompetensi>();
  const level = new Map<string, number>();
  for (const r of rows) {
    if (!ids.has(r.jabatan_id!)) continue;
    kompetensi.set(r.kompetensi_kode!, { kode: r.kompetensi_kode!, nama: r.kompetensi_nama!, kategori: r.kategori! });
    level.set(`${r.jabatan_id}|${r.kompetensi_kode}`, r.level_target!);
  }
  const kolom = [...kompetensi.values()].sort(
    (a, b) => URUT_KATEGORI.indexOf(a.kategori) - URUT_KATEGORI.indexOf(b.kategori) || a.kode.localeCompare(b.kode, "id", { numeric: true }),
  );
  return { jabatan, kompetensi: kolom, level, usulan: rows.some((r) => r.sumber === "usulan") };
}

import "server-only";
import { must, supabase } from "@/lib/supabase";

// Data untuk dokumen PDF (format mengikuti dokumen sumber di sumber-data/).

/** Karakter di luar subset latin font PDF (lihat font.ts) diganti agar tidak tampil sebagai kotak kosong. */
const bersihkan = (t: string) => t.replace(/○/g, "-");

export type Tugas = { kategori: string | null; deskripsi: string };

export type JobdeskDoc = {
  kodeDokumen: string;
  jenjang: number;
  nama: string;
  atasan: string | null;
  membawahi: string[];
  pendidikan: string | null;
  pendidikanTambahan: string | null;
  pangkat: string | null;
  pengalaman: string | null;
  kompetensi: string | null;
  fungsi: string[];
  tugas: Tugas[];
};

const JABATAN_KOLOM = "id, kode, nama, jenjang, atasan_nama, ikhtisar_jabatan, uraian_tugas, urutan";

type JabatanRow = {
  id: number | null;
  kode: string | null;
  nama: string | null;
  jenjang: number | null;
  atasan_nama: string | null;
  ikhtisar_jabatan: string | null;
  uraian_tugas: string[] | null;
};

async function susunJobdesk(jabatan: JabatanRow[]): Promise<JobdeskDoc[]> {
  const ids = jabatan.map((j) => j.id!);
  if (!ids.length) return [];
  const [docs, bawahan] = await Promise.all([
    supabase
      .from("jobdesk")
      .select(
        "jabatan_id, kode_dokumen, nama_jabatan, atasan_langsung, membawahi, pendidikan, pendidikan_tambahan, pangkat, pengalaman_kerja, kompetensi, fungsi, urutan, tugas:jobdesk_tugas(urutan, kategori, deskripsi)",
      )
      .in("jabatan_id", ids)
      .order("urutan")
      .then(must),
    supabase.from("jabatan").select("atasan_id, nama, urutan").in("atasan_id", ids).order("urutan").then(must),
  ]);

  return jabatan.map((j) => {
    // jabatan yang dibentuk dari beberapa dokumen kembar memakai dokumen pertama
    const d = docs.find((x) => x.jabatan_id === j.id);
    if (!d) {
      // jabatan tanpa dokumen jobdesk (mis. dibuat manual sebelum jobdesk diisi)
      return {
        kodeDokumen: j.kode!,
        jenjang: j.jenjang ?? 4,
        nama: j.nama!,
        atasan: j.atasan_nama,
        membawahi: bawahan.filter((b) => b.atasan_id === j.id).map((b) => b.nama),
        pendidikan: null,
        pendidikanTambahan: null,
        pangkat: null,
        pengalaman: null,
        kompetensi: null,
        fungsi: j.ikhtisar_jabatan ? [j.ikhtisar_jabatan] : [],
        tugas: (j.uraian_tugas ?? []).map((t) => ({ kategori: null, deskripsi: t })),
      };
    }
    return {
      kodeDokumen: d.kode_dokumen ?? j.kode!,
      jenjang: j.jenjang ?? 4,
      nama: d.nama_jabatan,
      atasan: d.atasan_langsung,
      membawahi: d.membawahi,
      pendidikan: d.pendidikan,
      pendidikanTambahan: d.pendidikan_tambahan,
      pangkat: d.pangkat,
      pengalaman: d.pengalaman_kerja,
      kompetensi: d.kompetensi,
      fungsi: d.fungsi.map(bersihkan),
      tugas: [...d.tugas].sort((a, b) => a.urutan - b.urutan).map(({ kategori, deskripsi }) => ({ kategori, deskripsi: bersihkan(deskripsi) })),
    };
  });
}

export async function loadJobdesk(kode: string): Promise<JobdeskDoc | null> {
  const j = await supabase.from("v_jabatan").select(JABATAN_KOLOM).eq("kode", kode).maybeSingle().then(must);
  return j ? (await susunJobdesk([j]))[0] : null;
}

/** Semua jobdesk satu divisi/kantor, urut sesuai bagan. */
export async function loadJobdeskUnit(unitInduk: string): Promise<JobdeskDoc[]> {
  const rows = await supabase
    .from("v_jabatan")
    .select(JABATAN_KOLOM)
    .eq("unit_induk_nama", unitInduk)
    .order("urutan")
    .then(must);
  return susunJobdesk(rows);
}

export type KompetensiDoc = {
  kode: string;
  nama: string;
  definisi: string | null;
  status: string;
  level: { level: number; nama_level: string; deskripsi: string | null; indikator: string[] }[];
};

export type BidangDoc = { kode: string; nama: string; kategori: string; kompetensi: KompetensiDoc[] };

const KOMPETENSI_KOLOM =
  "kode, nama, definisi, status, urutan, bidang_id, level:kompetensi_level(level, nama_level, deskripsi, indikator:indikator_perilaku(urutan, deskripsi))";

type KompetensiRow = {
  kode: string;
  nama: string;
  definisi: string | null;
  status: string;
  level: { level: number; nama_level: string; deskripsi: string | null; indikator: { urutan: number; deskripsi: string }[] }[];
};

function susunKompetensi(k: KompetensiRow): KompetensiDoc {
  return {
    kode: k.kode,
    nama: k.nama,
    definisi: k.definisi && bersihkan(k.definisi),
    status: k.status,
    level: [...k.level]
      .sort((a, b) => a.level - b.level)
      .map((l) => ({
        level: l.level,
        nama_level: l.nama_level,
        deskripsi: l.deskripsi && bersihkan(l.deskripsi),
        indikator: [...l.indikator].sort((a, b) => a.urutan - b.urutan).map((i) => bersihkan(i.deskripsi)),
      })),
  };
}

/** Satu bidang kamus; kode "semua" = seluruh bidang berurutan. Kompetensi berstatus "dihapus" tidak dicetak. */
export async function loadKamus(kodeBidang: string): Promise<BidangDoc[]> {
  let q = supabase.from("bidang_kompetensi").select("id, kode, nama, kategori").order("urutan");
  if (kodeBidang !== "semua") q = q.eq("kode", kodeBidang);
  const bidang = await q.then(must);
  if (!bidang.length) return [];
  const kompetensi = await supabase
    .from("kompetensi")
    .select(KOMPETENSI_KOLOM)
    .in("bidang_id", bidang.map((b) => b.id))
    .neq("status", "dihapus")
    .order("urutan")
    .then(must);
  return bidang.map((b) => ({
    kode: b.kode,
    nama: b.nama,
    kategori: b.kategori,
    kompetensi: kompetensi.filter((k) => k.bidang_id === b.id).map(susunKompetensi),
  }));
}

export async function loadKompetensi(kode: string): Promise<KompetensiDoc | null> {
  const k = await supabase.from("kompetensi").select(KOMPETENSI_KOLOM).eq("kode", kode).maybeSingle().then(must);
  return k ? susunKompetensi(k) : null;
}

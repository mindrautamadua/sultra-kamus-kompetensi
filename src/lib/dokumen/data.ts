import "server-only";
import { loadProfil, pembanding } from "@/lib/kedekatan";
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
      // nama dari tabel jabatan: nama_jabatan di jobdesk bisa tertinggal bila jabatan diganti nama
      nama: j.nama ?? d.nama_jabatan,
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

export type KompetensiProfil = {
  kode: string;
  nama: string;
  kategori: string;
  bidang: string | null;
  level: number;
  namaLevel: string;
  definisi: string | null;
  /** perilaku utama & indikator perilaku di level target */
  perilaku: string | null;
  indikator: string[];
  /** porsi & rata-rata level jabatan sejenjang yang memakai kompetensi ini (null bila tanpa pembanding) */
  sejenjang: { share: number; level: number } | null;
  usulan: boolean;
};

export type ProfilDoc = {
  kode: string;
  nama: string;
  jenjang: number;
  kelompok: string | null;
  unit: string | null;
  unitInduk: string | null;
  direktorat: string | null;
  atasan: string | null;
  bawahan: string[];
  fungsi: string[];
  jumlahTugas: number;
  tugasDidukung: number;
  review: { status: string; peninjau: string | null; tanggal: string } | null;
  pembanding: { lingkup: string; jumlah: number; rataKomp: number; rataLevel: number } | null;
  kompetensi: KompetensiProfil[];
};

const PROFIL_JABATAN_KOLOM = "id, kode, nama, jenjang, kelompok_jabatan, unit_nama, unit_induk_nama, direktorat, atasan_nama, ikhtisar_jabatan, uraian_tugas, urutan";
const BARIS_MAKS = 1000; // = max_rows PostgREST

type ProfilJabatanRow = {
  id: number | null;
  kode: string | null;
  nama: string | null;
  jenjang: number | null;
  kelompok_jabatan: string | null;
  unit_nama: string | null;
  unit_induk_nama: string | null;
  direktorat: string | null;
  atasan_nama: string | null;
  ikhtisar_jabatan: string | null;
  uraian_tugas: string[] | null;
};

async function susunProfil(jabatan: ProfilJabatanRow[]): Promise<ProfilDoc[]> {
  const ids = jabatan.map((j) => j.id!);
  if (!ids.length) return [];
  const pemetaan: {
    jabatan_id: number | null;
    kompetensi_id: number | null;
    kompetensi_kode: string | null;
    kompetensi_nama: string | null;
    kategori: string | null;
    bidang_nama: string | null;
    level_target: number | null;
    nama_level: string | null;
    sumber: string | null;
    bukti: number[] | null;
  }[] = [];
  for (let from = 0; ; from += BARIS_MAKS) {
    const rows = await supabase
      .from("v_jabatan_kompetensi")
      .select("jabatan_id, kompetensi_id, kompetensi_kode, kompetensi_nama, kategori, bidang_nama, level_target, nama_level, sumber, bukti")
      .in("jabatan_id", ids)
      .order("id")
      .range(from, from + BARIS_MAKS - 1)
      .then(must);
    pemetaan.push(...rows);
    if (rows.length < BARIS_MAKS) break;
  }
  const kompetensiIds = [...new Set(pemetaan.map((p) => p.kompetensi_id!))];
  const [kamus, bawahan, docs, review, semua] = await Promise.all([
    kompetensiIds.length
      ? supabase
          .from("kompetensi")
          .select("id, definisi, level:kompetensi_level(level, deskripsi, indikator:indikator_perilaku(urutan, deskripsi))")
          .in("id", kompetensiIds)
          .then(must)
      : Promise.resolve([]),
    supabase.from("jabatan").select("atasan_id, nama, urutan").in("atasan_id", ids).order("urutan").then(must),
    supabase.from("jobdesk").select("jabatan_id, fungsi, urutan").in("jabatan_id", ids).order("urutan").then(must),
    supabase.from("review_jabatan").select("jabatan_id, status, peninjau, updated_at").in("jabatan_id", ids).then(must),
    loadProfil(),
  ]);
  const kamusById = new Map(kamus.map((k) => [k.id, k]));

  return jabatan.map((j) => {
    const karyawan = (j.jenjang ?? 0) > 0;
    const pb = karyawan ? pembanding({ id: j.id!, jenjang: j.jenjang!, direktorat: j.direktorat }, semua) : null;
    const dipakai = pb && pb.sejenjang.length ? pb : null;
    const milik = pemetaan.filter((p) => p.jabatan_id === j.id);
    const tugas = j.uraian_tugas ?? [];
    const bukti = new Set(milik.flatMap((p) => p.bukti ?? []));
    // jabatan yang dibentuk dari beberapa dokumen kembar memakai dokumen pertama
    const doc = docs.find((d) => d.jabatan_id === j.id);
    const r = review.find((x) => x.jabatan_id === j.id);
    return {
      kode: j.kode!,
      nama: j.nama!,
      jenjang: j.jenjang ?? 4,
      kelompok: j.kelompok_jabatan,
      unit: j.unit_nama,
      unitInduk: j.unit_induk_nama,
      direktorat: j.direktorat,
      atasan: j.atasan_nama,
      bawahan: bawahan.filter((b) => b.atasan_id === j.id).map((b) => b.nama),
      fungsi: (doc?.fungsi.length ? doc.fungsi : j.ikhtisar_jabatan ? [j.ikhtisar_jabatan] : []).map(bersihkan),
      jumlahTugas: tugas.length,
      tugasDidukung: tugas.filter((_, i) => bukti.has(i + 1)).length,
      review: r ? { status: r.status, peninjau: r.peninjau, tanggal: r.updated_at } : null,
      pembanding: dipakai && { lingkup: dipakai.lingkup, jumlah: dipakai.sejenjang.length, rataKomp: dipakai.rataKomp, rataLevel: dipakai.rataLevel },
      kompetensi: milik.map((p) => {
        const k = kamusById.get(p.kompetensi_id!);
        const l = k?.level.find((x) => x.level === p.level_target);
        return {
          kode: p.kompetensi_kode!,
          nama: p.kompetensi_nama!,
          kategori: p.kategori!,
          bidang: p.bidang_nama,
          level: p.level_target ?? 1,
          namaLevel: p.nama_level ?? "",
          definisi: k?.definisi ? bersihkan(k.definisi) : null,
          perilaku: l?.deskripsi ? bersihkan(l.deskripsi) : null,
          indikator: l ? [...l.indikator].sort((a, b) => a.urutan - b.urutan).map((i) => bersihkan(i.deskripsi)) : [],
          sejenjang: dipakai && dipakai.pakai(p.kompetensi_kode!),
          usulan: p.sumber === "usulan",
        };
      }),
    };
  });
}

export async function loadProfilJabatan(kode: string): Promise<ProfilDoc | null> {
  const j = await supabase.from("v_jabatan").select(PROFIL_JABATAN_KOLOM).eq("kode", kode).maybeSingle().then(must);
  return j ? (await susunProfil([j]))[0] : null;
}

/** Profil semua jabatan satu divisi/kantor, urut sesuai bagan. */
export async function loadProfilUnit(unitInduk: string): Promise<ProfilDoc[]> {
  const rows = await supabase.from("v_jabatan").select(PROFIL_JABATAN_KOLOM).eq("unit_induk_nama", unitInduk).order("urutan").then(must);
  return susunProfil(rows);
}

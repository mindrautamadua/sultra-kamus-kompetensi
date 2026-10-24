import { cache } from "react";
import { JENJANG_LABEL } from "@/lib/labels";
import { must, supabase } from "@/lib/supabase";

// Kedekatan antarjabatan & kesenjangan kompetensi (jalur karier), dihitung dari pemetaan jabatan_kompetensi.

export type Kompetensi = { kode: string; nama: string; kategori: string; level: number };
export type Profil = {
  id: number;
  kode: string;
  nama: string;
  jenjang: number;
  kelompok: string;
  unit: string;
  unitInduk: string;
  direktorat: string | null; // null = jaringan kantor (cabang, fungsional)
  atasanId: number | null;
  kompetensi: Map<string, Kompetensi>;
};

const PAGE = 1000; // = max_rows PostgREST di supabase/config.toml

/** Semua jabatan (selain Direksi) beserta profil kompetensinya. Di-cache per request: detail jabatan & JalurCard berbagi hasilnya. */
export const loadProfil = cache(async (): Promise<Map<number, Profil>> => {
  const jabatan = await supabase
    .from("v_jabatan")
    .select("id, kode, nama, jenjang, kelompok_jabatan, unit_nama, unit_induk_nama, direktorat, atasan_id, urutan")
    .gt("jenjang", 0)
    .order("urutan")
    .then(must);
  const out = new Map<number, Profil>();
  for (const j of jabatan)
    out.set(j.id!, {
      id: j.id!,
      kode: j.kode!,
      nama: j.nama!,
      jenjang: j.jenjang!,
      kelompok: j.kelompok_jabatan!,
      unit: j.unit_nama!,
      unitInduk: j.unit_induk_nama!,
      direktorat: j.direktorat,
      atasanId: j.atasan_id,
      kompetensi: new Map(),
    });
  for (let from = 0; ; from += PAGE) {
    const rows = await supabase
      .from("v_jabatan_kompetensi")
      .select("jabatan_id, kompetensi_kode, kompetensi_nama, kategori, level_target")
      .order("id")
      .range(from, from + PAGE - 1)
      .then(must);
    for (const r of rows)
      out
        .get(r.jabatan_id!)
        ?.kompetensi.set(r.kompetensi_kode!, { kode: r.kompetensi_kode!, nama: r.kompetensi_nama!, kategori: r.kategori!, level: r.level_target! });
    if (rows.length < PAGE) break;
  }
  return out;
});

/**
 * Kemiripan profil teknis (weighted Jaccard atas level target): Σ min(level) / Σ max(level), 0–1.
 * Kompetensi inti & kepemimpinan diabaikan karena seragam per jenjang dan membuat semua jabatan tampak mirip.
 */
export function kemiripan(a: Profil, b: Profil): number {
  const kode = new Set([...a.kompetensi.keys(), ...b.kompetensi.keys()]);
  let min = 0;
  let max = 0;
  for (const k of kode) {
    const x = a.kompetensi.get(k);
    const y = b.kompetensi.get(k);
    if ((x ?? y)!.kategori !== "teknis") continue;
    min += Math.min(x?.level ?? 0, y?.level ?? 0);
    max += Math.max(x?.level ?? 0, y?.level ?? 0);
  }
  return max ? min / max : 0;
}

export type Kesenjangan = {
  baru: Kompetensi[]; // dibutuhkan tujuan, belum dimiliki asal
  naik: (Kompetensi & { dari: number })[]; // dimiliki, tapi level tujuan lebih tinggi
  memenuhi: (Kompetensi & { dari: number })[]; // level asal ≥ tujuan
  lepas: Kompetensi[]; // dimiliki asal, tidak dibutuhkan tujuan
  langkah: number; // total kenaikan level yang dibutuhkan (kompetensi baru dihitung dari 0)
  kemiripan: number;
};

const urut = (a: Kompetensi, b: Kompetensi) =>
  ["inti", "kepemimpinan", "teknis"].indexOf(a.kategori) - ["inti", "kepemimpinan", "teknis"].indexOf(b.kategori) ||
  a.kode.localeCompare(b.kode, "id", { numeric: true });

/** Apa yang perlu dikembangkan pemegang jabatan `asal` agar memenuhi profil jabatan `tujuan`. */
export function kesenjangan(asal: Profil, tujuan: Profil): Kesenjangan {
  const baru: Kompetensi[] = [];
  const naik: (Kompetensi & { dari: number })[] = [];
  const memenuhi: (Kompetensi & { dari: number })[] = [];
  for (const t of tujuan.kompetensi.values()) {
    const a = asal.kompetensi.get(t.kode);
    if (!a) baru.push(t);
    else if (t.level > a.level) naik.push({ ...t, dari: a.level });
    else memenuhi.push({ ...t, dari: a.level });
  }
  const lepas = [...asal.kompetensi.values()].filter((a) => !tujuan.kompetensi.has(a.kode));
  const langkah = baru.reduce((s, k) => s + k.level, 0) + naik.reduce((s, k) => s + k.level - k.dari, 0);
  return { baru: baru.sort(urut), naik: naik.sort(urut), memenuhi: memenuhi.sort(urut), lepas: lepas.sort(urut), langkah, kemiripan: kemiripan(asal, tujuan) };
}

export type Saran = { p: Profil; kemiripan: number; langkah: number; alasan: string };

/** Saran jalur dari satu jabatan: promosi (atasan + jenjang di atasnya) dan rotasi (sejenjang, unit lain). */
export function saranJalur(asal: Profil, semua: Map<number, Profil>, n = 6) {
  const lain = [...semua.values()].filter((p) => p.id !== asal.id && p.kompetensi.size > 0);
  const skor = (p: Profil, alasan: string): Saran => ({ p, kemiripan: kemiripan(asal, p), langkah: kesenjangan(asal, p).langkah, alasan });
  const atasan = asal.atasanId ? semua.get(asal.atasanId) : undefined;
  const promosi = lain
    .filter((p) => p.jenjang === asal.jenjang - 1 && p.id !== atasan?.id)
    .map((p) => skor(p, p.unitInduk === asal.unitInduk ? "satu unit" : "unit lain"))
    .sort((a, b) => b.kemiripan - a.kemiripan || a.langkah - b.langkah)
    .slice(0, n);
  if (atasan) promosi.unshift(skor(atasan, "atasan langsung"));
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .trim();
  const rotasi = lain
    .filter((p) => p.jenjang === asal.jenjang && p.unitInduk !== asal.unitInduk && norm(p.nama) !== norm(asal.nama))
    .map((p) => skor(p, p.unitInduk))
    .sort((a, b) => b.kemiripan - a.kemiripan || a.langkah - b.langkah)
    .slice(0, n);
  return { atasan, promosi, rotasi };
}

// kompetensi teknis yang dimiliki < KHAS jabatan pembanding dianggap ciri khas jabatan ini
export const KHAS = 0.15;
// pembanding minimal; bila rumpun (kantor pusat / jaringan kantor) terlalu kecil, pakai semua jabatan sejenjang
const MIN_PEMBANDING = 5;

const rata = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export type Pembanding = {
  sejenjang: Profil[];
  /** mis. "Kepala Seksi / Koordinator kantor pusat" */
  lingkup: string;
  /** porsi pembanding yang memakai kompetensi ini (0–1) dan rata-rata level targetnya */
  pakai: (kode: string) => { share: number; level: number };
  rataKomp: number;
  rataLevel: number;
};

/**
 * Pembanding: jabatan lain sejenjang yang sudah punya pemetaan, dalam rumpun yang sama — kantor pusat (punya
 * direktorat) atau jaringan kantor — supaya mis. Teller dibandingkan dengan pelaksana kantor cabang, bukan divisi.
 */
export function pembanding(j: { id: number; jenjang: number; direktorat: string | null }, semua: Map<number, Profil>): Pembanding {
  const semuaSejenjang = [...semua.values()].filter((p) => p.jenjang === j.jenjang && p.id !== j.id && p.kompetensi.size > 0);
  const pusat = !!j.direktorat;
  const serumpun = semuaSejenjang.filter((p) => !!p.direktorat === pusat);
  const sejenjang = serumpun.length >= MIN_PEMBANDING ? serumpun : semuaSejenjang;
  return {
    sejenjang,
    lingkup: `${JENJANG_LABEL[j.jenjang]}${sejenjang === serumpun ? (pusat ? " kantor pusat" : " jaringan kantor") : ""}`,
    pakai: (kode) => {
      const punya = sejenjang.filter((p) => p.kompetensi.has(kode));
      return { share: sejenjang.length ? punya.length / sejenjang.length : 0, level: rata(punya.map((p) => p.kompetensi.get(kode)!.level)) };
    },
    rataKomp: rata(sejenjang.map((p) => p.kompetensi.size)),
    rataLevel: rata(sejenjang.map((p) => rata([...p.kompetensi.values()].map((k) => k.level)))),
  };
}

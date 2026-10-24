import { cache } from "react";
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

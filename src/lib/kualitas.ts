import "server-only";
import { must, supabase } from "@/lib/supabase";

// Cek kualitas pemetaan jabatan–kompetensi; dipakai halaman Kualitas Pemetaan dan Laporan Eksekutif (PDF).

export type Profil = {
  id: number;
  kode: string;
  nama: string;
  jenjang: number;
  kelompok_jabatan: string;
  unit_induk_nama: string;
  unit_nama: string;
  jumlah_kompetensi: number;
  jumlah_teknis: number;
  jumlah_kepemimpinan: number;
  rata_level: number | null;
  profil: string[];
};

export const persen = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
// kelompok pemakaian kompetensi teknis: berapa jabatan yang memakai satu kompetensi
export const SEBARAN = [
  { label: "0", min: 0, max: 0, kelas: "bg-amber-400" },
  { label: "1", min: 1, max: 1, kelas: "bg-sky-300" },
  { label: "2–5", min: 2, max: 5, kelas: "bg-sky-400" },
  { label: "6–20", min: 6, max: 20, kelas: "bg-brand-500" },
  { label: "> 20", min: 21, max: Infinity, kelas: "bg-brand-800" },
];

export async function loadKualitas() {
  const [pemakaian, profilRaw, atasan, levelKamus, celah, totalTugas, luarBidangRaw, buktiRaw] = await Promise.all([
    supabase.from("v_kompetensi_pemakaian").select("*").neq("status", "dihapus").order("bidang_urutan").order("urutan").then(must),
    supabase.from("v_profil_jabatan").select("*").order("urutan").then(must),
    supabase.from("v_cek_level_atasan").select("*").then(must),
    supabase.from("v_cek_level_kamus").select("*").then(must),
    supabase
      .from("jobdesk_tugas")
      .select("id, urutan, deskripsi, catatan_tanpa_kode, jobdesk(kelompok_unit, jabatan(kode, nama))")
      .eq("tanpa_kompetensi", true)
      .order("jobdesk_id")
      .order("urutan")
      .then(must),
    supabase
      .from("jobdesk_tugas")
      .select("id", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    supabase
      .from("jobdesk_tugas")
      .select("id, urutan, deskripsi, saran_kompetensi, catatan_tanpa_kode, jobdesk(kelompok_unit, jabatan_id, jabatan(kode, nama))")
      .eq("alasan_tanpa_kode", "luar_bidang")
      .order("jobdesk_id")
      .order("urutan")
      .then(must),
    semuaBukti(),
  ]);
  const profil = profilRaw as unknown as Profil[];

  // ---- cakupan kamus
  // hanya kompetensi berstatus lengkap yang bisa dipetakan; draft/usulan dilaporkan terpisah
  const bisaDipakai = (k: (typeof pemakaian)[number]) => k.status === "lengkap";
  const teknis = pemakaian.filter((k) => k.kategori === "teknis" && bisaDipakai(k));
  const tidakDipakai = teknis.filter((k) => !k.jumlah_jabatan);
  const belumFinal = pemakaian.filter((k) => !bisaDipakai(k));
  const perBidang = groupBy(
    pemakaian.filter((k) => k.kategori === "teknis"),
    (k) => `${k.bidang_kode}|${k.bidang_nama}`,
  ).map(([key, ks]) => {
    const [kode, nama] = key.split("|");
    const jabatanPemakai = new Set(profil.filter((p) => p.profil.some((x) => x.startsWith(`${kode}-`))).map((p) => p.id)).size;
    return {
      kode,
      nama,
      total: ks.length,
      dipakai: ks.filter((k) => k.jumlah_jabatan).length,
      jabatanPemakai,
      kosong: ks.filter((k) => !k.jumlah_jabatan && bisaDipakai(k)),
    };
  })
    // bidang dengan kompetensi tidak dipakai terbanyak di atas; seri tetap urutan kamus (sort stabil)
    .sort((a, b) => b.kosong.length - a.kosong.length);
  const sebaran = SEBARAN.map((s) => ({ ...s, n: teknis.filter((k) => (k.jumlah_jabatan ?? 0) >= s.min && (k.jumlah_jabatan ?? 0) <= s.max).length }));
  const terpopuler = [...teknis].sort((a, b) => (b.jumlah_jabatan ?? 0) - (a.jumlah_jabatan ?? 0)).slice(0, 5);

  const perUnit = groupBy(profil, (p) => p.unit_induk_nama).map(([unit, ps]) => {
    const kode = new Set(ps.flatMap((p) => p.profil.map((x) => x.split(":")[0])).filter((k) => !k.startsWith("CC-") && !k.startsWith("LC-")));
    const bidang = new Set([...kode].map((k) => k.split("-")[0]));
    return { unit, jabatan: ps.length, kompetensi: kode.size, bidang: [...bidang] };
  });
  const maxKompUnit = Math.max(1, ...perUnit.map((u) => u.kompetensi));

  // ---- konsistensi: jabatan bernama sama di unit berbeda
  const normNama = (s: string) =>
    s
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/&/g, " dan ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const grupNama = groupBy(profil, (p) => normNama(p.nama))
    .filter(([, ps]) => ps.length > 1)
    .map(([, ps]) => {
      const peta = ps.map((p) => new Map(p.profil.map((x) => x.split(":") as [string, string])));
      const semua = [...new Set(peta.flatMap((m) => [...m.keys()]))].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
      const beda = semua.filter((k) => new Set(peta.map((m) => m.get(k) ?? "-")).size > 1);
      return { nama: ps[0].nama, ps, peta, beda, sama: semua.length - beda.length };
    })
    .filter((g) => g.beda.length > 0)
    .sort((a, b) => b.beda.length - a.beda.length);
  const namaKompetensi = new Map(pemakaian.map((k) => [k.kode!, k.nama!]));

  // ---- aturan kepemimpinan & kompetensi teknis
  const pelaksanaLC = profil.filter((p) => p.jenjang === 4 && p.jumlah_kepemimpinan > 0);
  const strukturalTanpaLC = profil.filter((p) => p.jenjang <= 3 && p.jumlah_kepemimpinan === 0);
  const tanpaTeknis = profil.filter((p) => p.jumlah_teknis === 0);

  // ---- outlier per jenjang (aturan IQR) untuk jumlah kompetensi & rata-rata level
  const outlier: { p: Profil; alasan: string }[] = [];
  for (const [jenjang, ps] of groupBy(profil, (p) => String(p.jenjang))) {
    for (const [ukuran, label] of [
      [(p: Profil) => p.jumlah_kompetensi, "jumlah kompetensi"],
      [(p: Profil) => p.rata_level ?? 0, "rata-rata level"],
    ] as const) {
      const xs = ps.map(ukuran).sort((a, b) => a - b);
      const q1 = xs[Math.floor(xs.length * 0.25)];
      const q3 = xs[Math.floor(xs.length * 0.75)];
      const iqr = q3 - q1;
      if (!iqr) continue; // seragam (mis. masih draf otomatis) → tidak ada outlier yang bermakna
      for (const p of ps) {
        const v = ukuran(p);
        if (v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr) outlier.push({ p, alasan: `${label} ${v} (umumnya ${q1}–${q3} di jenjang ${jenjang})` });
      }
    }
  }

  const aturan = pelaksanaLC.length + strukturalTanpaLC.length + tanpaTeknis.length;
  // butir tugas inti tanpa padanan kamus (hasil analisis AI), dikelompokkan per jabatan
  const celahPerJabatan = groupBy(
    celah.filter((t) => t.jobdesk?.jabatan),
    (t) => t.jobdesk!.jabatan!.kode,
  ).map(([kode, ts]) => ({ kode, nama: ts[0].jobdesk!.jabatan!.nama, unit: ts[0].jobdesk!.kelompok_unit.replace(/^\d+\.\s*/, ""), ts }));
  const celahPerUnit = groupBy(celahPerJabatan, (g) => g.unit)
    .map(([unit, gs]) => ({ unit, butir: gs.reduce((s, g) => s + g.ts.length, 0), jabatan: gs.length }))
    .sort((a, b) => b.butir - a.butir);

  // butir yang butuh kompetensi kamus belum dipetakan ke jabatannya; hilang dari daftar begitu kompetensi saran
  // dipetakan dengan butir itu sebagai bukti (simpanPemetaan mengisinya otomatis)
  const luarBidang = luarBidangRaw.filter(
    (t) => t.jobdesk?.jabatan && !t.saran_kompetensi.some((k) => buktiRaw.get(`${t.jobdesk!.jabatan_id}|${k}`)?.includes(t.urutan)),
  );
  const luarBidangPerJabatan = groupBy(luarBidang, (t) => t.jobdesk!.jabatan!.kode).map(([kode, ts]) => ({
    kode,
    nama: ts[0].jobdesk!.jabatan!.nama,
    unit: ts[0].jobdesk!.kelompok_unit.replace(/^\d+\.\s*/, ""),
    ts,
  }));
  // kompetensi kamus yang paling sering disarankan → kandidat ditambahkan ke banyak jabatan sekaligus
  const luarBidangPerKompetensi = groupBy(
    luarBidang.flatMap((t) => t.saran_kompetensi.map((k) => ({ k, jabatan: t.jobdesk!.jabatan!.kode }))),
    (x) => x.k,
  )
    .map(([kode, xs]) => ({ kode, butir: xs.length, jabatan: new Set(xs.map((x) => x.jabatan)).size }))
    .sort((a, b) => b.butir - a.butir);

  // ---- temuan per jabatan: berapa jenis cek yang menyangkut tiap jabatan
  const cek = [
    { key: "celah", label: "Tugas tanpa padanan", kode: celahPerJabatan.map((g) => g.kode), href: "#celah" },
    { key: "luar", label: "Butuh kompetensi lain", kode: luarBidangPerJabatan.map((g) => g.kode), href: "#luar-bidang" },
    { key: "nama", label: "Sama nama, profil beda", kode: grupNama.flatMap((g) => g.ps.map((p) => p.kode)), href: "#nama-sama" },
    { key: "atasan", label: "Level melebihi atasan", kode: atasan.map((r) => r.jabatan_kode!), href: "#atasan" },
    {
      key: "aturan",
      label: "Aturan dasar",
      kode: [...pelaksanaLC, ...strukturalTanpaLC, ...tanpaTeknis].map((p) => p.kode).concat(levelKamus.map((r) => r.jabatan_kode!)),
      href: "#aturan",
    },
    { key: "outlier", label: "Profil menyimpang", kode: outlier.map((o) => o.p.kode), href: "#outlier" },
  ];
  const temuan = new Map<string, Set<string>>();
  for (const c of cek) for (const k of c.kode) temuan.set(k, (temuan.get(k) ?? new Set()).add(c.label));
  const bersih = profil.length - temuan.size;
  const prioritas = [...temuan.entries()]
    .map(([kode, s]) => ({ p: profil.find((p) => p.kode === kode)!, cek: [...s] }))
    .filter((x) => x.p)
    .sort((a, b) => b.cek.length - a.cek.length || a.p.jenjang - b.p.jenjang)
    .slice(0, 8);

  const ringkas = [
    { href: "#tidak-dipakai", label: "Kompetensi teknis tidak dipakai", nilai: `${tidakDipakai.length}/${teknis.length}`, n: tidakDipakai.length },
    { href: "#celah", label: "Tugas inti tanpa padanan kamus", nilai: String(celah.length), n: celah.length },
    { href: "#luar-bidang", label: "Tugas butuh kompetensi belum dipetakan", nilai: String(luarBidang.length), n: luarBidang.length },
    { href: "#nama-sama", label: "Jabatan sama nama, profil beda", nilai: String(grupNama.length), n: grupNama.length },
    { href: "#atasan", label: "Level bawahan > atasan", nilai: String(atasan.length), n: atasan.length },
    { href: "#aturan", label: "Pelanggaran aturan dasar", nilai: String(aturan + levelKamus.length), n: aturan + levelKamus.length },
    { href: "#outlier", label: "Profil menyimpang (outlier)", nilai: String(outlier.length), n: outlier.length },
  ];
  const cekAman = ringkas.filter((r) => !r.n).length;

  return {
    profil,
    teknis,
    tidakDipakai,
    belumFinal,
    perBidang,
    sebaran,
    terpopuler,
    perUnit,
    maxKompUnit,
    grupNama,
    namaKompetensi,
    pelaksanaLC,
    strukturalTanpaLC,
    tanpaTeknis,
    outlier,
    aturan,
    celahPerJabatan,
    celahPerUnit,
    cek,
    temuan,
    bersih,
    prioritas,
    ringkas,
    cekAman,
    pemakaian,
    atasan,
    levelKamus,
    celah,
    totalTugas,
    luarBidang,
    luarBidangPerJabatan,
    luarBidangPerKompetensi,
  };
}

/** jabatan_id|kode kompetensi → nomor butir bukti, untuk seluruh pemetaan (dibaca per halaman PostgREST). */
async function semuaBukti() {
  const m = new Map<string, number[]>();
  for (let from = 0; ; from += 1000) {
    const rows = await supabase
      .from("v_jabatan_kompetensi")
      .select("jabatan_id, kompetensi_kode, bukti")
      .order("id")
      .range(from, from + 999)
      .then(must);
    for (const r of rows) if (r.bukti?.length) m.set(`${r.jabatan_id}|${r.kompetensi_kode}`, r.bukti);
    if (rows.length < 1000) break;
  }
  return m;
}

export function groupBy<T>(xs: T[], key: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m];
}

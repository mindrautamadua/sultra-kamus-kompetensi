import "server-only";
import { loadProfil } from "@/lib/kedekatan";
import { loadKualitas } from "@/lib/kualitas";
import { must, supabase } from "@/lib/supabase";

// Data Laporan Eksekutif (PDF untuk Direksi). Angka diambil dari sumber yang sama dengan halaman
// Analisa, Kualitas Pemetaan, dan Progres Review agar laporan selalu cocok dengan aplikasi.

const HARI = 24 * 60 * 60 * 1000;
const LAJU_HARI = 28; // sama dengan halaman Progres Review

const rata = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export type LaporanData = {
  dicetak: Date;
  kamus: {
    total: number;
    lengkap: number;
    indikator: number;
    bidang: { kode: string; nama: string; kategori: string; kompetensi: number; lengkap: number; indikator: number; dipakai: number; jabatanPemakai: number }[];
    belumFinal: number;
  };
  jabatan: {
    total: number;
    pusat: number;
    perJenjang: { jj: number; n: number; rataKomp: number; rataLevel: number; sebaran: number[] }[];
    perDirektorat: { nama: string; n: number }[];
  };
  pemakaian: { teknis: number; tidakDipakai: number; terpopuler: { kode: string; nama: string; n: number }[] };
  kualitas: {
    total: number;
    bersih: number;
    cek: { label: string; nilai: string; n: number }[];
    tugasTotal: number;
    celah: number;
    celahPerUnit: { unit: string; butir: number; jabatan: number }[];
  };
  review: { total: number; selesai: number; draf: number; perJenjang: { jj: number; total: number; selesai: number }[]; lajuMinggu: number; eta: Date | null };
};

export async function loadLaporan(): Promise<LaporanData> {
  const sekarang = Date.now();
  const [bidang, kualitas, profil, review, riwayat] = await Promise.all([
    supabase.from("v_statistik_bidang").select("kode, nama, kategori, jumlah_kompetensi, jumlah_lengkap, jumlah_indikator").order("urutan").then(must),
    loadKualitas(),
    loadProfil(),
    supabase.from("v_review_jabatan").select("jenjang, status").then(must),
    supabase
      .from("review_riwayat")
      .select("status_dari, status_ke, created_at")
      .gte("created_at", new Date(sekarang - LAJU_HARI * HARI).toISOString())
      .limit(1000)
      .then(must),
  ]);

  const ps = [...profil.values()];
  const perJenjang = [1, 2, 3, 4].map((jj) => {
    const js = ps.filter((p) => p.jenjang === jj);
    const sebaran = [0, 0, 0, 0, 0];
    for (const p of js) for (const k of p.kompetensi.values()) if (k.level) sebaran[k.level - 1]++;
    const terpetakan = js.filter((p) => p.kompetensi.size);
    return {
      jj,
      n: js.length,
      rataKomp: rata(terpetakan.map((p) => p.kompetensi.size)),
      rataLevel: rata(terpetakan.map((p) => rata([...p.kompetensi.values()].map((k) => k.level)))),
      sebaran,
    };
  });
  const direktorat = new Map<string, number>();
  for (const p of ps) direktorat.set(p.direktorat ?? "Jaringan kantor", (direktorat.get(p.direktorat ?? "Jaringan kantor") ?? 0) + 1);

  const selesaiBaru = riwayat.filter((r) => r.status_ke === "selesai" && r.status_dari !== "selesai").length;
  const lajuHarian = selesaiBaru / LAJU_HARI;
  const draf = review.filter((r) => r.status === "draf").length;

  return {
    dicetak: new Date(sekarang),
    kamus: {
      total: bidang.reduce((s, b) => s + (b.jumlah_kompetensi ?? 0), 0),
      lengkap: bidang.reduce((s, b) => s + (b.jumlah_lengkap ?? 0), 0),
      indikator: bidang.reduce((s, b) => s + (b.jumlah_indikator ?? 0), 0),
      bidang: bidang.map((b) => {
        const pb = kualitas.perBidang.find((x) => x.kode === b.kode);
        return {
          kode: b.kode!,
          nama: b.nama!,
          kategori: b.kategori!,
          kompetensi: b.jumlah_kompetensi ?? 0,
          lengkap: b.jumlah_lengkap ?? 0,
          indikator: b.jumlah_indikator ?? 0,
          dipakai: pb?.dipakai ?? 0,
          jabatanPemakai: pb?.jabatanPemakai ?? 0,
        };
      }),
      belumFinal: kualitas.belumFinal.length,
    },
    jabatan: {
      total: ps.length,
      pusat: ps.filter((p) => p.direktorat).length,
      perJenjang,
      perDirektorat: [...direktorat].map(([nama, n]) => ({ nama, n })).sort((a, b) => b.n - a.n),
    },
    pemakaian: {
      teknis: kualitas.teknis.length,
      tidakDipakai: kualitas.tidakDipakai.length,
      terpopuler: kualitas.terpopuler.map((k) => ({ kode: k.kode!, nama: k.nama!, n: k.jumlah_jabatan ?? 0 })),
    },
    kualitas: {
      total: kualitas.profil.length,
      bersih: kualitas.bersih,
      cek: kualitas.ringkas.map(({ label, nilai, n }) => ({ label, nilai, n })),
      tugasTotal: kualitas.totalTugas,
      celah: kualitas.celah.length,
      celahPerUnit: kualitas.celahPerUnit.slice(0, 5),
    },
    review: {
      total: review.length,
      selesai: review.filter((r) => r.status === "selesai").length,
      draf,
      perJenjang: [1, 2, 3, 4].map((jj) => {
        const js = review.filter((r) => r.jenjang === jj);
        return { jj, total: js.length, selesai: js.filter((r) => r.status === "selesai").length };
      }),
      lajuMinggu: lajuHarian * 7,
      eta: lajuHarian > 0 && draf > 0 ? new Date(sekarang + (draf / lajuHarian) * HARI) : null,
    },
  };
}

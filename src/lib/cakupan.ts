// Cakupan uraian tugas oleh kompetensi: tiap butir tugas digolongkan menurut bukti pemetaan teknis
// dan, bila bukan bukti, alasan hasil analisis AI (jobdesk_tugas.alasan_tanpa_kode).

export type JenisButir = "teknis" | "kepemimpinan" | "umum" | "terlewat" | "luar_bidang" | "celah";
export type ButirAnalisis = { urutan: number; tanpa_kompetensi: boolean; alasan_tanpa_kode: string | null };

/** Butir tanpa bukti teknis yang sudah tercakup kompetensi inti/kepemimpinan — tidak perlu tindak lanjut. */
export const DICAKUP_INTI: JenisButir[] = ["kepemimpinan", "umum"];
/** Butir yang masih perlu tindak lanjut HC/konsultan. */
export const PERLU_TINDAK: JenisButir[] = ["terlewat", "luar_bidang", "celah"];

/** Jenis butir tugas ke-n (1-based). Tanpa analisis AI: celah bila ditandai, selain itu tugas kepemimpinan/umum. */
export function jenisButir(n: number, bukti: Set<number>, butir: Map<number, ButirAnalisis>, struktural: boolean): JenisButir {
  if (bukti.has(n)) return "teknis";
  const t = butir.get(n);
  return (t?.alasan_tanpa_kode ?? (t?.tanpa_kompetensi ? "celah" : struktural ? "kepemimpinan" : "umum")) as JenisButir;
}

export type Cakupan = Record<JenisButir, number> & { total: number; didukung: number; tindak: number };

/** Rekap cakupan seluruh butir: didukung = berbukti teknis atau dicakup kompetensi inti/kepemimpinan. */
export function cakupanTugas(jumlah: number, bukti: Set<number>, butir: Map<number, ButirAnalisis>, struktural: boolean): Cakupan {
  const c: Cakupan = { teknis: 0, kepemimpinan: 0, umum: 0, terlewat: 0, luar_bidang: 0, celah: 0, total: jumlah, didukung: 0, tindak: 0 };
  for (let n = 1; n <= jumlah; n++) c[jenisButir(n, bukti, butir, struktural)]++;
  c.didukung = c.teknis + c.kepemimpinan + c.umum;
  c.tindak = c.terlewat + c.luar_bidang + c.celah;
  return c;
}

/** Rincian butir yang perlu tindak lanjut, mis. "1 belum dicantumkan sebagai bukti, 2 butuh kompetensi lain". */
export function rincianTindak(c: Cakupan): string {
  return [
    c.terlewat && `${c.terlewat} belum dicantumkan sebagai bukti`,
    c.luar_bidang && `${c.luar_bidang} butuh kompetensi kamus yang belum dipetakan`,
    c.celah && `${c.celah} celah kamus`,
  ]
    .filter(Boolean)
    .join(", ");
}

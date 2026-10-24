// Aturan penilaian diri, dipakai bersama oleh UI (hasil langsung saat mencentang) dan Server Action (nilai yang disimpan).

/** Sebuah level dianggap tercapai bila minimal 2/3 indikatornya dicentang. */
export const AMBANG = 2 / 3;

export const kunciIndikator = (level: number, urutan: number) => `${level}.${urutan}`;

/** Jumlah indikator minimal yang harus dicentang agar level dengan `total` indikator tercapai. */
export const minimalCentang = (total: number) => Math.ceil(total * AMBANG - 1e-9);

/**
 * Level tertinggi yang tercapai secara berurutan dari level 1 (0 = belum ada).
 * Berhenti di level pertama yang tidak tercapai, juga bila level itu belum punya indikator,
 * supaya level atas tidak terhitung tanpa dasar.
 */
export function hitungLevel(levels: { level: number; urutan: number[] }[], dicentang: Set<string>) {
  let hasil = 0;
  for (const l of [...levels].sort((a, b) => a.level - b.level)) {
    const n = l.urutan.filter((u) => dicentang.has(kunciIndikator(l.level, u))).length;
    if (l.urutan.length === 0 || n < minimalCentang(l.urutan.length)) break;
    hasil = l.level;
  }
  return hasil;
}

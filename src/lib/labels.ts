export const STATUS_LABEL: Record<string, string> = {
  lengkap: "Lengkap",
  draft: "Draft",
  usulan: "Usulan",
  dihapus: "Dihapus",
  belum_disusun: "Belum disusun",
};

export const STATUS_STYLE: Record<string, string> = {
  lengkap: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  draft: "bg-amber-50 text-amber-800 ring-amber-600/20",
  usulan: "bg-sky-50 text-sky-700 ring-sky-600/20",
  dihapus: "bg-rose-50 text-rose-700 ring-rose-600/20",
  belum_disusun: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export const KATEGORI_LABEL: Record<string, string> = {
  inti: "Inti",
  kepemimpinan: "Kepemimpinan",
  teknis: "Teknis",
};

export const LEVEL_NAMA = ["Dasar", "Memadai", "Mandiri", "Mahir", "Master"] as const;

/** Level target awal saat kompetensi ditambahkan ke jabatan, menurut jenjang jabatan. */
export const LEVEL_JENJANG: Record<number, number> = { 0: 5, 1: 5, 2: 4, 3: 3, 4: 2 };

export const JENJANG_LABEL: Record<number, string> = {
  0: "Direksi",
  1: "Kepala Divisi / Pemimpin",
  2: "Kepala Bagian",
  3: "Kepala Seksi / Koordinator",
  4: "Pelaksana",
};

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("id-ID");

// Status review pemetaan per jabatan (tabel review_jabatan; tanpa baris = draf)
export const REVIEW_STATUS = ["draf", "selesai"] as const;
export const REVIEW_LABEL: Record<string, string> = {
  draf: "Draf",
  selesai: "Selesai",
};
export const REVIEW_STYLE: Record<string, string> = {
  draf: "bg-slate-100 text-slate-600 ring-slate-300",
  selesai: "bg-emerald-50 text-emerald-800 ring-emerald-300",
};
// warna batang progres (urutan sama dengan REVIEW_STATUS)
export const REVIEW_BAR: Record<string, string> = {
  draf: "bg-slate-300",
  selesai: "bg-emerald-500",
};

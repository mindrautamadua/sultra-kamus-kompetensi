// Peran akun dan hak masing-masing. Dipakai server (Server Actions memeriksa ulang) maupun tampilan
// (menyembunyikan tombol yang tidak berhak). Kolom pengguna.peran, lihat migrasi peran_pengguna.

export const PERAN = ["admin", "editor", "pembaca"] as const;
export type Peran = (typeof PERAN)[number];

export const PERAN_LABEL: Record<Peran, string> = {
  admin: "Admin",
  editor: "Editor",
  pembaca: "Pembaca",
};

export const PERAN_PENJELASAN: Record<Peran, string> = {
  admin: "Kelola akun dan pengaturan, edit isi, dan menandai jabatan selesai.",
  editor: "Konsultan: edit kamus, jabatan, jobdesk, dan pemetaan, lalu menandai jabatan selesai untuk diserahkan ke HC.",
  pembaca: "Hanya melihat dan mengunduh dokumen.",
};

export const TIDAK_BERHAK = "Peran akun Anda tidak berhak melakukan ini.";

export const bolehEdit = (p: Peran | null | undefined) => p === "admin" || p === "editor";
export const bolehKelolaAkun = (p: Peran | null | undefined) => p === "admin";

/**
 * Status review yang boleh dituju peran ini dari status saat ini. Tidak ada tahap persetujuan: konsultan (editor)
 * menandai jabatan Selesai untuk diserahkan ke Divisi HC, dan bisa membukanya kembali ke Draf.
 */
export function statusTujuan(p: Peran | null | undefined, dari: string): string[] {
  if (!bolehEdit(p)) return [];
  return dari === "selesai" ? ["draf"] : ["selesai"];
}

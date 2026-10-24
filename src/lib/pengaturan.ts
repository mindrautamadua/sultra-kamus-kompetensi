import "server-only";
import { cache } from "react";
import type { Database } from "@/lib/database.types";
import { admin } from "@/lib/supabase-admin";

// Pengaturan aplikasi (tabel pengaturan, satu baris) yang diubah admin di halaman Admin › Pengaturan.

export type Pengaturan = Omit<Database["public"]["Tables"]["pengaturan"]["Row"], "id">;

/** Sama dengan default kolom di migrasi pengaturan; dipakai bila baris belum ada. */
export const PENGATURAN_BAWAAN: Pengaturan = {
  edisi_judul: "Struktur Perubahan Ketiga",
  edisi_keterangan: "10 Juli 2026 · data draf untuk review HC",
  batas_gagal_login: 5,
  lama_kunci_menit: 15,
  lama_sesi_jam: 8,
  lama_ingat_hari: 30,
  panjang_password_min: 10,
  diubah_oleh: null,
  updated_at: "",
};

/** Batas tiap angka, sama dengan check constraint di migrasi; dipakai validasi form dan atribut min/max input. */
export const BATAS_ANGKA = {
  batas_gagal_login: { min: 3, max: 20, label: "Batas gagal login" },
  lama_kunci_menit: { min: 1, max: 1440, label: "Lama akun terkunci (menit)" },
  lama_sesi_jam: { min: 1, max: 24, label: "Lama sesi login (jam)" },
  lama_ingat_hari: { min: 1, max: 90, label: "Lama \"Ingat saya\" (hari)" },
  panjang_password_min: { min: 8, max: 64, label: "Panjang password minimal" },
} as const;

/**
 * Dibaca sekali per permintaan. Galat (mis. migrasi belum dijalankan) tidak menghentikan aplikasi:
 * login dan sidebar tetap jalan memakai nilai bawaan.
 */
export const bacaPengaturan = cache(async (): Promise<Pengaturan> => {
  const { data, error } = await admin()
    .from("pengaturan")
    .select("edisi_judul, edisi_keterangan, batas_gagal_login, lama_kunci_menit, lama_sesi_jam, lama_ingat_hari, panjang_password_min, diubah_oleh, updated_at")
    .maybeSingle();
  return error || !data ? PENGATURAN_BAWAAN : data;
});

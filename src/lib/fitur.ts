// Fitur yang disembunyikan sementara. Kodenya tetap ada agar mudah dihidupkan lagi.

/**
 * Penilaian diri (src/app/(app)/penilaian-diri, src/lib/penilaian.ts): dinonaktifkan 2026-10-24 karena hanya
 * HC yang login, jadi karyawan yang semestinya menilai diri tidak bisa memakainya. Untuk menghidupkan lagi:
 * jalankan migrasi 20261023190000_penilaian_diri.sql di cloud, lalu ubah nilai ini menjadi true.
 */
export const PENILAIAN_DIRI_AKTIF = false;

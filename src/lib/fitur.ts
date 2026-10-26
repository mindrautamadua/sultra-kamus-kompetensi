// Fitur yang disembunyikan sementara. Kodenya tetap ada agar mudah dihidupkan lagi.

/**
 * Penilaian diri (src/app/(app)/penilaian-diri, src/lib/penilaian.ts): dinonaktifkan 2026-10-24 karena hanya
 * HC yang login, jadi karyawan yang semestinya menilai diri tidak bisa memakainya. Untuk menghidupkan lagi:
 * jalankan migrasi 20261023190000_penilaian_diri.sql di cloud, lalu ubah nilai ini menjadi true.
 */
export const PENILAIAN_DIRI_AKTIF = false;

/**
 * Jalur Karier (src/app/(app)/karier, src/lib/kedekatan.ts, kartu jalur di detail jabatan, PDF /dokumen/karier):
 * disimpan dulu 2026-10-24 atas permintaan user. Ubah nilai ini menjadi true untuk menampilkannya lagi.
 */
export const JALUR_KARIER_AKTIF = false;

/**
 * Menu Universe Kompetensi (src/app/(app)/universe): disembunyikan dari sidebar 2026-10-26 atas permintaan user.
 * Halamannya tetap bisa dibuka lewat /universe. Ubah nilai ini menjadi true untuk menampilkan menunya lagi.
 */
export const MENU_UNIVERSE_AKTIF = false;

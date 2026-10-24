# Kamus Kompetensi — Bank Sultra

Aplikasi Next.js + Supabase (lokal) untuk kamus kompetensi, daftar jabatan dari struktur organisasi,
dan (tahap berikutnya) pemetaan kompetensi yang dibutuhkan per jabatan.

## Menjalankan

```bash
npm install
npm run db:start      # Supabase lokal (Docker/OrbStack) — API :54621, DB :54622, Studio :54623
npm run dev           # http://localhost:3000
```

`.env.local` berisi URL & publishable key Supabase lokal (lihat `npx supabase status`).

## Mengedit data

Tombol **Edit** ada di halaman detail jabatan (`/jabatan/<kode>/edit`: data jabatan, jobdesk, kompetensi + level target, hapus)
dan detail kompetensi (`/kompetensi/<kode>/edit`: nama, definisi, status, catatan, deskripsi & indikator tiap level).
Jabatan baru: tombol **Tambah jabatan** di Daftar Jabatan, atau klik kotak "Ada di bagan, belum ada jobdesk" di Ringkasan.

Penyimpanan lewat Server Actions dengan `SUPABASE_SERVICE_ROLE_KEY` (hanya di server, dari `.env.local`). Aplikasi tanpa login —
siapa pun yang bisa membuka aplikasi bisa mengedit.

Pemetaan dikerjakan konsultan (editor) lalu diserahkan ke Divisi HC setelah selesai — tidak ada tahap persetujuan di aplikasi.
Status per jabatan hanya **Draf → Selesai**, ditandai di panel **Status review** pada detail jabatan (dengan opsi lanjut ke jabatan
draf berikutnya) atau sekaligus di **Progres Review › Tandai selesai massal** (`/review/selesai`). Mengedit jabatan yang sudah
Selesai otomatis mengembalikannya ke Draf. Rekap di halaman **Progres Review**, riwayat di tabel `review_riwayat`.

**Penting:** setelah ada edit di aplikasi, database menjadi sumber utama. `npm run db:reset` membangun ulang data dari dokumen
dan **menghapus semua hasil edit**. Amankan dulu:

```bash
npm run db:backup                 # -> supabase/backup/data-<tanggal>.sql
npm run db:restore                # pulihkan backup terbaru (atau: npm run db:restore -- <file>)
```

## Login

Semua halaman, PDF, dan unduhan wajib login (`src/proxy.ts`). Akun disimpan di tabel `pengguna` (bukan Supabase Auth),
password di-hash scrypt; cookie sesi ditandatangani `SESSION_SECRET` di `.env.local`. Batas gagal login (bawaan 5x = terkunci
15 menit), lama sesi (8 jam / 30 hari dengan "Ingat saya"), dan panjang password minimal (10) diatur admin di
**Admin › Pengaturan** (tabel `pengaturan`, `src/lib/pengaturan.ts`), begitu pula teks edisi data di sidebar.

Tiap akun punya satu peran (`pengguna.peran`, aturan di `src/lib/peran.ts`, diperiksa ulang di setiap Server Action):

| Peran | Hak |
|---|---|
| admin | kelola akun & pengaturan (menu *Admin*: `/admin/pengguna`, `/admin/pengaturan`), edit isi, tandai selesai |
| editor | konsultan: edit kamus, jabatan, jobdesk, pemetaan; tandai jabatan Selesai / buka kembali ke Draf |
| pembaca | hanya melihat & mengunduh (mis. Divisi HC) |

Admin biasanya mengelola akun dari aplikasi; CLI tetap tersedia:

```bash
npm run pengguna -- daftar
npm run pengguna -- tambah <username> "<Nama Lengkap>" [peran]   # default editor; password acak dicetak sekali
npm run pengguna -- peran <username> <admin|editor|pembaca>
npm run pengguna -- reset <username>                             # password baru + buka kunci
npm run pengguna -- nonaktif <username>                          # atau: aktif <username>
```

## Dokumen PDF

Dokumen dibuat langsung dari database (termasuk hasil edit di aplikasi) dengan format meniru dokumen sumber.
Tambahkan `?unduh=1` untuk mengunduh alih-alih membuka di penampil PDF browser.

| URL | Isi |
| --- | --- |
| `/dokumen/jobdesk/<kode jabatan>` | Uraian Tugas Pegawai satu jabatan |
| `/dokumen/jobdesk?unit=<nama divisi/kantor>` | Uraian tugas seluruh jabatan satu divisi/kantor (nomor halaman per jabatan) |
| `/dokumen/kamus/<kode bidang>` | Kamus kompetensi satu bidang (mis. `HCM`, `CC`); `semua` = seluruh kamus |
| `/dokumen/kompetensi/<kode>` | Satu kompetensi |

Kode generator di `src/lib/dokumen/`. Font asli jobdesk (FS Albert) berlisensi, jadi diganti Albert Sans; kamus memakai Tinos
(setara Times New Roman). Tanggal di kepala jobdesk tetap `10/07/2026` (`TANGGAL_DOKUMEN`).

## Data

| Sumber (`sumber-data/`) | Hasil |
| --- | --- |
| 14 file `GT-Kamus ... .docx` | `bidang_kompetensi`, `kompetensi`, `kompetensi_level`, `indikator_perilaku`, `kompetensi_bidang_terkait` |
| Folder per unit (`1. Cabang Utama/` … `21. KANTOR FUNGSIONAL/`) — hanya file Word (`.docx`; `.doc` dikonversi dengan `textutil`), salinan PDF diabaikan | `jobdesk`, `jobdesk_tugas` |
| Dokumen jobdesk yang sama (struktur Perubahan Ketiga 2026; satu dokumen = satu jabatan) | `unit_kerja`, `jabatan` |
| `STRUKTUR … .pdf` per folder (export draw.io) — hanya cek silang: kotak bagan tanpa jobdesk | `bagan_tanpa_jobdesk` (+ `unit_kerja.catatan`) |

`Struktur Organisasi … 2024 rev 0325.pdf` dan `parse_struktur_organisasi.py` (bagan 2024) tidak dipakai lagi.

Pipeline ETL (Python):

```bash
npm run etl        # sumber-data -> supabase/data/*.json -> supabase/seed.sql
npm run db:reset   # terapkan migration + seed ulang
```

Jalankan ulang keduanya setiap kali dokumen di `sumber-data/` diperbarui.

Normalisasi yang dilakukan parser (detail di halaman **Analisa Data**):

- IAD: penomoran di dokumen dobel (`IAD-04` dua kali) → dinomori ulang 01–25 sesuai file kompilasi.
- Salah ketik prefix `SBP-02` / `CSP-12` → `SPB-02` / `SPB-12`.
- `GCL-06 A/B`, `GCL-10 A/B` → `GCL-06A`, `GCL-06B`, dst.
- Opsi penggabungan FNM-01 s/d FNM-05 disimpan sebagai `FNM-M01` (status `usulan`).
- ITD-20/22/23 & GCL-11 yang dicantumkan di kamus Risk Management → relasi `kompetensi_bidang_terkait`.
- Catatan review di judul (`> level 1`, `>> Umum`, `sampai L-2`, dll.) disimpan di kolom `catatan`.

## Skema utama

- `jobdesk` (satu baris per dokumen) + `jobdesk_tugas` (butir tugas, dengan kategori Perencanaan/Pengorganisasian/…/Kewenangan).
- `jabatan` dibangun dari jobdesk: kode = `<unit>-<nomor dokumen>` (mis. `D14-14.A.1`), atasan dari kolom "Atasan Langsung"
  (cadangan: nomor dokumen, alasannya dicatat di `jabatan.catatan`). `ikhtisar_jabatan` & `uraian_tugas` diisi dari jobdesk-nya.
- `jabatan_kompetensi (jabatan_id, kompetensi_id, level_target, sumber, skor)` — pemetaan kompetensi per jabatan.
  Kompetensi teknis usulan berasal dari **analisis AI** yang dijalankan sekali di Claude Code (tanpa API di aplikasi):
  `supabase/data/pemetaan_ai.json` (digabung oleh `scripts/etl/gabung_pemetaan_ai.py`) berisi kompetensi, level, bukti (nomor butir
  tugas) dan alasan per jabatan, plus butir tugas yang tidak terwakili kamus (`jobdesk_tugas.tanpa_kompetensi`). Jabatan yang jobdesk-nya
  berubah sejak dianalisis (jumlah butir tugas beda) otomatis kembali ke TF-IDF di bawah — analisis ulang jabatan itu bila perlu.
  Cadangan TF-IDF dari `scripts/etl/build_pemetaan.py`: CC untuk semua jabatan, LC untuk jenjang 1–3,
  kompetensi teknis 3–6 per jabatan dari bidang unitnya berdasarkan kemiripan teks jobdesk vs kamus (TF-IDF);
  level target = jenjang (Pelaksana 2, Kasie/Koordinator 3, Kabag/Ketua 4, Kadiv 5; Pemimpin KCU 5, KC 4, KCP/KF 3),
  dibatasi catatan "sampai L-n". **`db:reset` menimpa seluruh tabel ini** — hasil review manual perlu disimpan di sumber lain dulu.
- View: `v_kompetensi`, `v_statistik_bidang`, `v_statistik_level`, `v_level_indikator`, `v_jabatan`, `v_jobdesk`, `v_jabatan_kompetensi`.

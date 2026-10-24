-- Peran (role) akun aplikasi. Hak tiap peran ditegakkan di server (src/lib/peran.ts + Server Actions):
--   admin     : kelola akun + edit isi + ajukan review (tidak bisa menyetujui)
--   editor    : edit kamus, jabatan, jobdesk, pemetaan + ajukan review
--   penyetuju : menyetujui atau mengembalikan (perlu revisi) pemetaan; tidak mengedit isi
--   pembaca   : hanya melihat & mengunduh
-- Akun yang sudah ada menjadi admin agar tidak ada yang kehilangan akses saat migrasi.

alter table public.pengguna
  add column peran text not null default 'pembaca' check (peran in ('admin', 'editor', 'penyetuju', 'pembaca'));
update public.pengguna set peran = 'admin';
comment on column public.pengguna.peran is 'admin | editor | penyetuju | pembaca — lihat src/lib/peran.ts.';

-- Riwayat review mencatat akun pelakunya, tidak hanya nama yang diketik.
alter table public.review_riwayat
  add column pengguna_id bigint references public.pengguna(id) on delete set null;
comment on column public.review_riwayat.pengguna_id is 'Akun yang melakukan aksi (null untuk riwayat sebelum ada login).';

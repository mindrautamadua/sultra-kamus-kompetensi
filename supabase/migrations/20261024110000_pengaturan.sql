-- Pengaturan aplikasi yang bisa diubah admin dari halaman Admin › Pengaturan (src/app/(app)/admin/pengaturan).
-- Satu baris saja (id selalu true). Dibaca server lewat src/lib/pengaturan.ts; nilai bawaan di sana harus sama
-- dengan default kolom di bawah agar aplikasi tetap jalan bila baris belum ada.

create table public.pengaturan (
  id                   boolean primary key default true check (id),
  edisi_judul          text not null default 'Struktur Perubahan Ketiga' check (length(edisi_judul) between 1 and 80),
  edisi_keterangan     text not null default '10 Juli 2026 · data draf untuk review HC' check (length(edisi_keterangan) <= 160),
  batas_gagal_login    smallint not null default 5 check (batas_gagal_login between 3 and 20),
  lama_kunci_menit     smallint not null default 15 check (lama_kunci_menit between 1 and 1440),
  lama_sesi_jam        smallint not null default 8 check (lama_sesi_jam between 1 and 24),
  lama_ingat_hari      smallint not null default 30 check (lama_ingat_hari between 1 and 90),
  panjang_password_min smallint not null default 10 check (panjang_password_min between 8 and 64),
  diubah_oleh          bigint references public.pengguna(id) on delete set null,
  updated_at           timestamptz not null default now()
);
comment on table public.pengaturan is 'Pengaturan aplikasi (satu baris). Diubah admin lewat halaman Admin › Pengaturan.';
comment on column public.pengaturan.edisi_judul is 'Judul kotak edisi data di sidebar, mis. nama struktur organisasi yang dipakai.';
comment on column public.pengaturan.lama_sesi_jam is 'Masa berlaku login tanpa "Ingat saya". Berlaku untuk login berikutnya.';

insert into public.pengaturan default values;

create trigger pengaturan_updated_at before update on public.pengaturan
  for each row execute function public.set_updated_at();

alter table public.pengaturan enable row level security;
revoke all on public.pengaturan from anon, authenticated;

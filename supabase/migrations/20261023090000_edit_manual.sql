-- Dukungan edit dari aplikasi: jobdesk/jabatan yang dibuat manual tidak punya file sumber,
-- dan setiap baris mencatat kapan terakhir diubah dari aplikasi.

alter table public.jobdesk alter column file_sumber drop not null;
alter table public.jobdesk add column diubah_di_aplikasi timestamptz;
alter table public.jabatan add column diubah_di_aplikasi timestamptz;
alter table public.kompetensi add column diubah_di_aplikasi timestamptz;
comment on column public.jabatan.diubah_di_aplikasi is 'Terakhir diubah lewat halaman edit aplikasi; null = masih sesuai hasil impor dokumen.';

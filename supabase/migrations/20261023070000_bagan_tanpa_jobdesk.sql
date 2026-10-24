-- Kotak jabatan di bagan per folder (STRUKTUR *.pdf) yang belum punya dokumen jobdesk
create table public.bagan_tanpa_jobdesk (
  id            bigint generated always as identity primary key,
  unit_kerja_id bigint not null references public.unit_kerja (id) on delete cascade,
  label         text not null,
  file_sumber   text not null,
  urutan        int not null default 0
);
comment on table public.bagan_tanpa_jobdesk is 'Jabatan yang tergambar di bagan unit tetapi tidak ditemukan dokumen jobdesk-nya (bisa juga hanya beda penamaan). Diisi oleh scripts/etl/build_struktur_2026.py.';

alter table public.bagan_tanpa_jobdesk enable row level security;
create policy "baca bagan_tanpa_jobdesk" on public.bagan_tanpa_jobdesk for select to anon, authenticated using (true);

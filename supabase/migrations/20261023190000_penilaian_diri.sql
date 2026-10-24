-- Penilaian diri (self-assessment): pengguna mencentang indikator perilaku yang sudah rutin ia lakukan,
-- lalu aplikasi memperkirakan levelnya dan membandingkannya dengan level target jabatan.
-- Satu baris per pengguna per kompetensi; disimpan ulang setiap kali penilaian diperbarui.
-- Seperti pengguna, hanya dibaca/ditulis server memakai service role.

create table public.penilaian_diri (
  id              bigint generated always as identity primary key,
  pengguna_id     bigint not null references public.pengguna(id) on delete cascade,
  kompetensi_id   bigint not null references public.kompetensi(id) on delete cascade,
  jabatan_id      bigint references public.jabatan(id) on delete set null,
  dicentang       text[] not null default '{}' check (array_to_string(dicentang, ',') ~ '^([1-5]\.[1-9][0-9]?(,|$))*$'),
  level_perkiraan smallint not null check (level_perkiraan between 0 and 5),
  level_target    smallint check (level_target between 1 and 5),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (pengguna_id, kompetensi_id)
);
comment on table public.penilaian_diri is 'Penilaian diri pengguna per kompetensi. Hasilnya subjektif: bahan awal, bukan pengganti assessment resmi.';
comment on column public.penilaian_diri.dicentang is 'Indikator yang dicentang sebagai "level.urutan" (mis. 3.2). Bukan id indikator, karena editor kompetensi membuat ulang baris indikator saat menyimpan.';
comment on column public.penilaian_diri.level_perkiraan is 'Level tertinggi yang tercapai berurutan dari level 1 (0 = belum ada); dihitung server saat menyimpan, lihat src/lib/penilaian.ts.';
comment on column public.penilaian_diri.level_target is 'Salinan level target jabatan_id untuk kompetensi ini saat penilaian disimpan.';

create index on public.penilaian_diri (kompetensi_id);

create trigger penilaian_diri_updated_at before update on public.penilaian_diri
  for each row execute function public.set_updated_at();

alter table public.penilaian_diri enable row level security;
revoke all on public.penilaian_diri from anon, authenticated;

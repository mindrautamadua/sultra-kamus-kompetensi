-- Skema Kamus Kompetensi & Struktur Organisasi Bank Sultra

-- =========================================================
-- KAMUS KOMPETENSI
-- =========================================================

create table public.bidang_kompetensi (
  id          bigint generated always as identity primary key,
  kode        text not null unique,
  nama        text not null,
  kategori    text not null check (kategori in ('inti', 'kepemimpinan', 'teknis')),
  file_sumber text,
  urutan      int not null default 0
);
comment on table public.bidang_kompetensi is 'Kelompok/bidang kamus kompetensi (Core, Leadership, dan 13 bidang teknis).';

create table public.kompetensi (
  id              bigint generated always as identity primary key,
  kode            text not null unique,
  bidang_id       bigint not null references public.bidang_kompetensi (id) on delete restrict,
  nama            text not null,
  nama_daftar_isi text,
  definisi        text,
  status          text not null default 'lengkap'
                  check (status in ('lengkap', 'draft', 'usulan', 'dihapus', 'belum_disusun')),
  tanda_c         boolean not null default false,
  catatan         text[] not null default '{}',
  kode_dokumen    text,
  file_sumber     text,
  urutan          int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on column public.kompetensi.tanda_c is 'Penanda "(C)" pada judul kompetensi di dokumen sumber.';
comment on column public.kompetensi.kode_dokumen is 'Kode sebagaimana tertulis di dokumen bila berbeda dari kode yang dinormalisasi.';
comment on column public.kompetensi.catatan is 'Catatan review/diskusi yang tertulis di dokumen sumber (mis. "> level 1", ">> Umum").';
create index on public.kompetensi (bidang_id);

create table public.kompetensi_level (
  id            bigint generated always as identity primary key,
  kompetensi_id bigint not null references public.kompetensi (id) on delete cascade,
  level         smallint not null check (level between 1 and 5),
  nama_level    text not null check (nama_level in ('Dasar', 'Memadai', 'Mandiri', 'Mahir', 'Master')),
  deskripsi     text,
  unique (kompetensi_id, level)
);

create table public.indikator_perilaku (
  id                  bigint generated always as identity primary key,
  kompetensi_level_id bigint not null references public.kompetensi_level (id) on delete cascade,
  urutan              smallint not null,
  deskripsi           text not null,
  unique (kompetensi_level_id, urutan)
);

-- kompetensi milik satu bidang yang juga dicantumkan di kamus bidang lain
create table public.kompetensi_bidang_terkait (
  kompetensi_id bigint not null references public.kompetensi (id) on delete cascade,
  bidang_id     bigint not null references public.bidang_kompetensi (id) on delete cascade,
  catatan       text,
  primary key (kompetensi_id, bidang_id)
);

-- =========================================================
-- STRUKTUR ORGANISASI & JABATAN
-- =========================================================

create table public.unit_kerja (
  id         bigint generated always as identity primary key,
  kode       text not null unique,
  nama       text not null,
  jenis      text not null check (jenis in ('dewan', 'direksi', 'divisi', 'bagian', 'seksi', 'kelompok', 'kantor')),
  parent_id  bigint references public.unit_kerja (id) on delete restrict,
  direktorat text,
  catatan    text,
  urutan     int not null default 0
);
create index on public.unit_kerja (parent_id);

create table public.jabatan (
  id               bigint generated always as identity primary key,
  kode             text not null unique,
  nama             text not null,
  nama_asli        text,
  unit_kerja_id    bigint not null references public.unit_kerja (id) on delete restrict,
  jenjang          smallint not null check (jenjang between 0 and 4),
  kelompok_jabatan text not null,
  atasan_id        bigint references public.jabatan (id) on delete set null,
  ikhtisar_jabatan text,
  uraian_tugas     text[] not null default '{}',
  catatan          text,
  urutan           int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on column public.jabatan.jenjang is '0 = Direksi, 1 = Kepala Divisi/Pemimpin Kantor, 2 = Kepala Bagian, 3 = Kepala Seksi/Koordinator, 4 = Pelaksana.';
comment on column public.jabatan.ikhtisar_jabatan is 'Ringkasan tujuan jabatan (diisi saat jobdesk tersedia).';
comment on column public.jabatan.uraian_tugas is 'Daftar uraian tugas/jobdesk (diisi saat jobdesk tersedia).';
create index on public.jabatan (unit_kerja_id);
create index on public.jabatan (atasan_id);

-- Pemetaan kompetensi yang dibutuhkan per jabatan beserta level target
create table public.jabatan_kompetensi (
  id            bigint generated always as identity primary key,
  jabatan_id    bigint not null references public.jabatan (id) on delete cascade,
  kompetensi_id bigint not null references public.kompetensi (id) on delete cascade,
  level_target  smallint not null check (level_target between 1 and 5),
  catatan       text,
  created_at    timestamptz not null default now(),
  unique (jabatan_id, kompetensi_id)
);
create index on public.jabatan_kompetensi (kompetensi_id);

-- =========================================================
-- updated_at trigger
-- =========================================================

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger kompetensi_updated_at before update on public.kompetensi
  for each row execute function public.set_updated_at();
create trigger jabatan_updated_at before update on public.jabatan
  for each row execute function public.set_updated_at();

-- =========================================================
-- VIEWS
-- =========================================================

create view public.v_kompetensi with (security_invoker = true) as
select
  k.id, k.kode, k.nama, k.definisi, k.status, k.tanda_c, k.catatan, k.kode_dokumen, k.urutan,
  b.id as bidang_id, b.kode as bidang_kode, b.nama as bidang_nama, b.kategori,
  (select count(*) from public.kompetensi_level l where l.kompetensi_id = k.id)::int as jumlah_level,
  (select count(*) from public.kompetensi_level l
     join public.indikator_perilaku i on i.kompetensi_level_id = l.id
   where l.kompetensi_id = k.id)::int as jumlah_indikator
from public.kompetensi k
join public.bidang_kompetensi b on b.id = k.bidang_id;

create view public.v_statistik_bidang with (security_invoker = true) as
select
  b.id, b.kode, b.nama, b.kategori, b.urutan,
  count(k.id)::int as jumlah_kompetensi,
  count(k.id) filter (where k.status = 'lengkap')::int as jumlah_lengkap,
  count(k.id) filter (where k.status <> 'lengkap')::int as jumlah_perlu_tindak_lanjut,
  count(k.id) filter (where k.tanda_c)::int as jumlah_tanda_c,
  count(k.id) filter (where cardinality(k.catatan) > 0)::int as jumlah_dengan_catatan,
  coalesce(sum(vk.jumlah_indikator), 0)::int as jumlah_indikator
from public.bidang_kompetensi b
left join public.kompetensi k on k.bidang_id = b.id
left join public.v_kompetensi vk on vk.id = k.id
group by b.id;

create view public.v_level_indikator with (security_invoker = true) as
select l.id, l.level, l.nama_level, k.kode, k.nama, count(i.id)::int as jumlah_indikator
from public.kompetensi_level l
join public.kompetensi k on k.id = l.kompetensi_id
left join public.indikator_perilaku i on i.kompetensi_level_id = l.id
group by l.id, k.id;

create view public.v_statistik_level with (security_invoker = true) as
select level, nama_level,
  count(*)::int as jumlah_level,
  round(avg(jumlah_indikator), 2)::float as rata_indikator,
  count(*) filter (where jumlah_indikator = 0)::int as tanpa_indikator
from public.v_level_indikator
group by level, nama_level;

create view public.v_jabatan with (security_invoker = true) as
select
  j.id, j.kode, j.nama, j.nama_asli, j.jenjang, j.kelompok_jabatan, j.catatan, j.urutan,
  j.ikhtisar_jabatan, j.uraian_tugas,
  u.id as unit_kerja_id, u.kode as unit_kode, u.nama as unit_nama, u.jenis as unit_jenis,
  coalesce(root.nama, u.nama) as unit_induk_nama,
  coalesce(root.direktorat, u.direktorat) as direktorat,
  a.id as atasan_id, a.kode as atasan_kode, a.nama as atasan_nama,
  (select count(*) from public.jabatan_kompetensi jk where jk.jabatan_id = j.id)::int as jumlah_kompetensi
from public.jabatan j
join public.unit_kerja u on u.id = j.unit_kerja_id
left join public.jabatan a on a.id = j.atasan_id
left join lateral (
  -- unit induk = unit tertinggi tepat di bawah Direksi/Dewan Komisaris (divisi, kantor, bagian mandiri)
  with recursive up as (
    select uk.id, uk.nama, uk.parent_id, uk.direktorat
    from public.unit_kerja uk where uk.id = u.id
    union all
    select p.id, p.nama, p.parent_id, p.direktorat
    from public.unit_kerja p join up on p.id = up.parent_id
  )
  select up.nama, up.direktorat from up
  where up.parent_id in (select id from public.unit_kerja where jenis in ('direksi', 'dewan'))
  limit 1
) root on true;

-- =========================================================
-- RLS: baca terbuka (aplikasi internal lokal); tulis via service role
-- =========================================================

alter table public.bidang_kompetensi enable row level security;
alter table public.kompetensi enable row level security;
alter table public.kompetensi_level enable row level security;
alter table public.indikator_perilaku enable row level security;
alter table public.kompetensi_bidang_terkait enable row level security;
alter table public.unit_kerja enable row level security;
alter table public.jabatan enable row level security;
alter table public.jabatan_kompetensi enable row level security;

create policy "baca bidang_kompetensi" on public.bidang_kompetensi for select to anon, authenticated using (true);
create policy "baca kompetensi" on public.kompetensi for select to anon, authenticated using (true);
create policy "baca kompetensi_level" on public.kompetensi_level for select to anon, authenticated using (true);
create policy "baca indikator_perilaku" on public.indikator_perilaku for select to anon, authenticated using (true);
create policy "baca kompetensi_bidang_terkait" on public.kompetensi_bidang_terkait for select to anon, authenticated using (true);
create policy "baca unit_kerja" on public.unit_kerja for select to anon, authenticated using (true);
create policy "baca jabatan" on public.jabatan for select to anon, authenticated using (true);
create policy "baca jabatan_kompetensi" on public.jabatan_kompetensi for select to anon, authenticated using (true);

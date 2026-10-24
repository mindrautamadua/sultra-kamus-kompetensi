-- Status review pemetaan per jabatan (usulan -> ditinjau -> disetujui, atau perlu revisi) beserta riwayatnya.
-- Jabatan tanpa baris di review_jabatan dianggap berstatus 'usulan' (draf otomatis, belum disentuh).

create table public.review_jabatan (
  jabatan_id bigint primary key references public.jabatan (id) on delete cascade,
  status     text not null check (status in ('usulan', 'ditinjau', 'disetujui', 'perlu_revisi')),
  peninjau   text,
  catatan    text,
  updated_at timestamptz not null default now()
);

create table public.review_riwayat (
  id          bigint generated always as identity primary key,
  jabatan_id  bigint not null references public.jabatan (id) on delete cascade,
  aksi        text not null,
  status_dari text,
  status_ke   text,
  peninjau    text,
  catatan     text,
  created_at  timestamptz not null default now()
);
comment on column public.review_riwayat.aksi is 'ubah_status, simpan_jobdesk, simpan_kompetensi, simpan_jabatan.';
create index on public.review_riwayat (jabatan_id, created_at desc);
create index on public.review_riwayat (created_at desc);

create view public.v_review_jabatan with (security_invoker = true) as
select
  j.id as jabatan_id, j.kode, j.nama, j.jenjang, j.kelompok_jabatan, j.unit_induk_nama, j.unit_nama, j.urutan,
  coalesce(r.status, 'usulan') as status, r.peninjau, r.catatan, r.updated_at
from public.v_jabatan j
left join public.review_jabatan r on r.jabatan_id = j.id
where j.jenjang > 0;

alter table public.review_jabatan enable row level security;
alter table public.review_riwayat enable row level security;
create policy "baca review_jabatan" on public.review_jabatan for select to anon, authenticated using (true);
create policy "baca review_riwayat" on public.review_riwayat for select to anon, authenticated using (true);

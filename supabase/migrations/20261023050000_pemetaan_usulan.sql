-- Pemetaan kompetensi per jabatan: bedakan draf otomatis (usulan) dari hasil review (manual)

alter table public.jabatan_kompetensi
  add column sumber text not null default 'manual' check (sumber in ('usulan', 'manual')),
  add column skor   real;
comment on column public.jabatan_kompetensi.sumber is 'usulan = draf otomatis dari scripts/etl/build_pemetaan.py (ditimpa saat db:reset); manual = hasil review.';
comment on column public.jabatan_kompetensi.skor is 'Skor kemiripan uraian tugas vs kompetensi (hanya kompetensi teknis usulan).';

create view public.v_jabatan_kompetensi with (security_invoker = true) as
select
  jk.id, jk.level_target, jk.sumber, jk.skor, jk.catatan,
  j.id as jabatan_id, j.kode as jabatan_kode, j.nama as jabatan_nama, j.jenjang,
  k.id as kompetensi_id, k.kode as kompetensi_kode, k.nama as kompetensi_nama,
  b.kode as bidang_kode, b.nama as bidang_nama, b.kategori,
  l.nama_level, l.deskripsi as level_deskripsi
from public.jabatan_kompetensi jk
join public.jabatan j on j.id = jk.jabatan_id
join public.kompetensi k on k.id = jk.kompetensi_id
join public.bidang_kompetensi b on b.id = k.bidang_id
left join public.kompetensi_level l on l.kompetensi_id = k.id and l.level = jk.level_target;

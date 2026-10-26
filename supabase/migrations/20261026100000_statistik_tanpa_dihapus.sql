-- Kompetensi berstatus "dihapus" (hapus lunak dari halaman edit) tidak ikut statistik dasbor, analisa, dan laporan.
-- Kolom view tidak berubah; create or replace mempertahankan hak akses yang sudah diatur.

create or replace view public.v_statistik_bidang with (security_invoker = true) as
select
  b.id, b.kode, b.nama, b.kategori, b.urutan,
  count(k.id)::int as jumlah_kompetensi,
  count(k.id) filter (where k.status = 'lengkap')::int as jumlah_lengkap,
  count(k.id) filter (where k.status <> 'lengkap')::int as jumlah_perlu_tindak_lanjut,
  count(k.id) filter (where k.tanda_c)::int as jumlah_tanda_c,
  count(k.id) filter (where cardinality(k.catatan) > 0)::int as jumlah_dengan_catatan,
  coalesce(sum(vk.jumlah_indikator), 0)::int as jumlah_indikator
from public.bidang_kompetensi b
left join public.kompetensi k on k.bidang_id = b.id and k.status <> 'dihapus'
left join public.v_kompetensi vk on vk.id = k.id
group by b.id;

create or replace view public.v_level_indikator with (security_invoker = true) as
select l.id, l.level, l.nama_level, k.kode, k.nama, count(i.id)::int as jumlah_indikator
from public.kompetensi_level l
join public.kompetensi k on k.id = l.kompetensi_id
left join public.indikator_perilaku i on i.kompetensi_level_id = l.id
where k.status <> 'dihapus'
group by l.id, k.id;

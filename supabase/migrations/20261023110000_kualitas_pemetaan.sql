-- View untuk halaman Kualitas Pemetaan: cakupan kamus & cek konsistensi jabatan–kompetensi.
-- Semua dihitung langsung dari tabel, jadi ikut berubah saat HC mengedit pemetaan di aplikasi.

-- Pemakaian tiap kompetensi oleh jabatan
create view public.v_kompetensi_pemakaian with (security_invoker = true) as
select
  k.id, k.kode, k.nama, k.status, k.urutan,
  b.kode as bidang_kode, b.nama as bidang_nama, b.kategori, b.urutan as bidang_urutan,
  count(jk.id)::int as jumlah_jabatan
from public.kompetensi k
join public.bidang_kompetensi b on b.id = k.bidang_id
left join public.jabatan_kompetensi jk on jk.kompetensi_id = k.id
group by k.id, b.id;

-- Profil ringkas pemetaan per jabatan (selain Direksi)
create view public.v_profil_jabatan with (security_invoker = true) as
select
  j.id, j.kode, j.nama, j.jenjang, j.kelompok_jabatan, j.unit_induk_nama, j.unit_nama, j.urutan,
  count(vk.id)::int as jumlah_kompetensi,
  count(vk.id) filter (where vk.kategori = 'teknis')::int as jumlah_teknis,
  count(vk.id) filter (where vk.kategori = 'kepemimpinan')::int as jumlah_kepemimpinan,
  count(vk.id) filter (where vk.kategori = 'inti')::int as jumlah_inti,
  round(avg(vk.level_target), 2)::float as rata_level,
  coalesce(array_agg(vk.kompetensi_kode || ':' || vk.level_target order by vk.kompetensi_kode) filter (where vk.id is not null), '{}') as profil,
  bool_or(vk.sumber = 'manual') as ada_manual
from public.v_jabatan j
left join public.v_jabatan_kompetensi vk on vk.jabatan_id = j.id
where j.jenjang > 0
group by j.id, j.kode, j.nama, j.jenjang, j.kelompok_jabatan, j.unit_induk_nama, j.unit_nama, j.urutan;

-- Level target bawahan lebih tinggi dari atasannya untuk kompetensi yang sama
create view public.v_cek_level_atasan with (security_invoker = true) as
select
  b.kode as jabatan_kode, b.nama as jabatan_nama, u.nama as unit_nama,
  a.kode as atasan_kode, a.nama as atasan_nama,
  k.kode as kompetensi_kode, k.nama as kompetensi_nama,
  jb.level_target as level_bawahan, ja.level_target as level_atasan
from public.jabatan_kompetensi jb
join public.jabatan b on b.id = jb.jabatan_id
join public.unit_kerja u on u.id = b.unit_kerja_id
join public.jabatan a on a.id = b.atasan_id
join public.jabatan_kompetensi ja on ja.jabatan_id = a.id and ja.kompetensi_id = jb.kompetensi_id
join public.kompetensi k on k.id = jb.kompetensi_id
where ja.level_target < jb.level_target;

-- Level target melebihi level tertinggi yang punya isi di kamus
create view public.v_cek_level_kamus with (security_invoker = true) as
select
  j.kode as jabatan_kode, j.nama as jabatan_nama, k.kode as kompetensi_kode, k.nama as kompetensi_nama,
  jk.level_target,
  (select max(l.level) from public.kompetensi_level l where l.kompetensi_id = k.id)::int as level_tersedia
from public.jabatan_kompetensi jk
join public.jabatan j on j.id = jk.jabatan_id
join public.kompetensi k on k.id = jk.kompetensi_id
where jk.level_target > coalesce((select max(l.level) from public.kompetensi_level l where l.kompetensi_id = k.id), 0);

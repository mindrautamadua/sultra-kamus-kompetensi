-- Pemetaan berbukti: tiap kompetensi jabatan menyimpan butir tugas pendukung dan metode asalnya;
-- butir tugas inti yang tidak terwakili kompetensi apa pun di kamus ditandai (celah kamus).

alter table public.jabatan_kompetensi
  add column bukti smallint[] not null default '{}',
  add column metode text check (metode in ('aturan', 'tfidf', 'ai', 'manual'));
comment on column public.jabatan_kompetensi.bukti is 'Nomor urut butir tugas (jobdesk_tugas.urutan pada jobdesk utama jabatan) yang mendukung kompetensi ini.';
comment on column public.jabatan_kompetensi.metode is 'Asal usulan: aturan (inti/kepemimpinan per jenjang), tfidf (kemiripan teks), ai (analisis AI atas jobdesk), manual (ditambah HC).';

alter table public.jobdesk_tugas add column tanpa_kompetensi boolean not null default false;
comment on column public.jobdesk_tugas.tanpa_kompetensi is 'Butir tugas inti yang tidak terwakili kompetensi teknis mana pun di kamus (hasil analisis AI) — bahan review kamus.';

create or replace view public.v_jabatan_kompetensi with (security_invoker = true) as
select
  jk.id, jk.level_target, jk.sumber, jk.skor, jk.catatan,
  j.id as jabatan_id, j.kode as jabatan_kode, j.nama as jabatan_nama, j.jenjang,
  k.id as kompetensi_id, k.kode as kompetensi_kode, k.nama as kompetensi_nama,
  b.kode as bidang_kode, b.nama as bidang_nama, b.kategori,
  l.nama_level, l.deskripsi as level_deskripsi,
  jk.bukti, jk.metode
from public.jabatan_kompetensi jk
join public.jabatan j on j.id = jk.jabatan_id
join public.kompetensi k on k.id = jk.kompetensi_id
join public.bidang_kompetensi b on b.id = k.bidang_id
left join public.kompetensi_level l on l.kompetensi_id = k.id and l.level = jk.level_target;

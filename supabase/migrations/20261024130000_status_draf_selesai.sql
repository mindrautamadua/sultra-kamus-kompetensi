-- Alur review disederhanakan: pemetaan dikerjakan konsultan (editor) lalu diserahkan ke Divisi HC setelah selesai,
-- tanpa tahap persetujuan di aplikasi. Status jabatan tinggal draf -> selesai; peran penyetuju dihapus.
--   usulan / ditinjau / perlu_revisi -> draf      disetujui -> selesai
-- Akun penyetuju menjadi pembaca (tetap bisa melihat & mengunduh).

alter table public.review_jabatan drop constraint review_jabatan_status_check;
update public.review_jabatan set status = case status when 'disetujui' then 'selesai' else 'draf' end;
alter table public.review_jabatan add constraint review_jabatan_status_check check (status in ('draf', 'selesai'));
comment on column public.review_jabatan.status is 'draf | selesai. Jabatan tanpa baris dianggap draf.';

-- riwayat ikut dipetakan agar label lama tetap terbaca; baris yang jadi draf -> draf tidak lagi menampilkan perubahan status
update public.review_riwayat set
  status_dari = case status_dari when 'disetujui' then 'selesai' else 'draf' end,
  status_ke   = case status_ke when 'disetujui' then 'selesai' else 'draf' end
where status_dari is not null or status_ke is not null;

create or replace view public.v_review_jabatan with (security_invoker = true) as
select
  j.id as jabatan_id, j.kode, j.nama, j.jenjang, j.kelompok_jabatan, j.unit_induk_nama, j.unit_nama, j.urutan,
  coalesce(r.status, 'draf') as status, r.peninjau, r.catatan, r.updated_at
from public.v_jabatan j
left join public.review_jabatan r on r.jabatan_id = j.id
where j.jenjang > 0;

alter table public.pengguna drop constraint pengguna_peran_check;
update public.pengguna set peran = 'pembaca' where peran = 'penyetuju';
alter table public.pengguna add constraint pengguna_peran_check check (peran in ('admin', 'editor', 'pembaca'));
comment on column public.pengguna.peran is 'admin | editor | pembaca — lihat src/lib/peran.ts.';

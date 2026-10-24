-- Alasan per butir tugas yang tidak menjadi bukti kompetensi teknis mana pun (analisis AI ulang atas butir tanpa kode).
-- tanpa_kompetensi tetap dipakai halaman Kualitas dan diselaraskan: true bila alasan_tanpa_kode = 'celah'.

alter table public.jobdesk_tugas
  add column alasan_tanpa_kode text check (alasan_tanpa_kode in ('kepemimpinan', 'umum', 'terlewat', 'luar_bidang', 'celah')),
  add column saran_kompetensi text[] not null default '{}',
  add column catatan_tanpa_kode text;
comment on column public.jobdesk_tugas.alasan_tanpa_kode is
  'Mengapa butir tidak berkode kompetensi teknis: kepemimpinan (dicakup LC), umum (dicakup kompetensi inti), terlewat (dicakup kompetensi teknis jabatan yang sudah dipetakan), luar_bidang (butuh kompetensi kamus yang belum dipetakan), celah (tidak ada padanan di kamus).';
comment on column public.jobdesk_tugas.saran_kompetensi is 'Kode kompetensi yang disarankan untuk alasan terlewat / luar_bidang.';
comment on column public.jobdesk_tugas.catatan_tanpa_kode is 'Penjelasan singkat alasan (hasil analisis AI).';

-- teks butir berubah = hasil analisis tidak berlaku lagi (penomoran ulang tidak mengubah apa pun: baris dipertahankan)
create function public.reset_alasan_tanpa_kode() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.alasan_tanpa_kode := null;
  new.saran_kompetensi := '{}';
  new.catatan_tanpa_kode := null;
  new.tanpa_kompetensi := false;
  return new;
end $$;

create trigger jobdesk_tugas_reset_alasan before update of deskripsi on public.jobdesk_tugas
  for each row when (old.deskripsi is distinct from new.deskripsi) execute function public.reset_alasan_tanpa_kode();

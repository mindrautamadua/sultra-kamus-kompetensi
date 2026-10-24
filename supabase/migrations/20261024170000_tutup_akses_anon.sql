-- Data kamus, jabatan, dan riwayat review hanya untuk akun yang login. Semua halaman membaca lewat server memakai
-- service role (src/lib/supabase.ts), jadi hak baca publishable key (anon) dicabut: tanpa ini siapa pun yang tahu
-- URL Supabase bisa membaca seluruh data tanpa login.

drop policy "baca bidang_kompetensi" on public.bidang_kompetensi;
drop policy "baca kompetensi" on public.kompetensi;
drop policy "baca kompetensi_level" on public.kompetensi_level;
drop policy "baca indikator_perilaku" on public.indikator_perilaku;
drop policy "baca kompetensi_bidang_terkait" on public.kompetensi_bidang_terkait;
drop policy "baca unit_kerja" on public.unit_kerja;
drop policy "baca jabatan" on public.jabatan;
drop policy "baca jabatan_kompetensi" on public.jabatan_kompetensi;
drop policy "baca jobdesk" on public.jobdesk;
drop policy "baca jobdesk_tugas" on public.jobdesk_tugas;
drop policy "baca bagan_tanpa_jobdesk" on public.bagan_tanpa_jobdesk;
drop policy "baca review_jabatan" on public.review_jabatan;
drop policy "baca review_riwayat" on public.review_riwayat;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;

-- tabel/fungsi yang dibuat migrasi berikutnya juga tidak otomatis terbuka untuk anon
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

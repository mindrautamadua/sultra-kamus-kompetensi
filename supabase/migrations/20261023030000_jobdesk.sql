-- Jobdesk (uraian tugas) per dokumen jabatan, dari sumber-data/<unit>/*.docx (Perubahan Ketiga 2026)

create table public.jobdesk (
  id                  bigint generated always as identity primary key,
  kode_dokumen        text,
  kelompok_unit       text not null,
  nama_jabatan        text not null,
  atasan_langsung     text,
  membawahi           text[] not null default '{}',
  pendidikan          text,
  pendidikan_tambahan text,
  pangkat             text,
  pengalaman_kerja    text,
  kompetensi          text,
  fungsi              text[] not null default '{}',
  jabatan_id          bigint references public.jabatan (id) on delete set null,
  file_sumber         text not null unique,
  urutan              int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.jobdesk is 'Satu baris per dokumen jobdesk. Daftar jabatan (struktur 2026) dibangun dari dokumen-dokumen ini.';
comment on column public.jobdesk.kode_dokumen is 'Nomor di awal nama file, mis. "1.A.1".';
comment on column public.jobdesk.kelompok_unit is 'Nama folder sumber, mis. "14. DIVISI HUMAN CAPITAL".';
comment on column public.jobdesk.jabatan_id is 'Jabatan yang dibentuk dari dokumen ini (dokumen ganda dengan nomor & nama sama menunjuk jabatan yang sama).';
create index on public.jobdesk (jabatan_id);

create table public.jobdesk_tugas (
  id         bigint generated always as identity primary key,
  jobdesk_id bigint not null references public.jobdesk (id) on delete cascade,
  urutan     smallint not null,
  kategori   text,
  deskripsi  text not null,
  unique (jobdesk_id, urutan)
);
comment on column public.jobdesk_tugas.kategori is 'Perencanaan / Pengorganisasian / Pengarahan / Pengawasan / Kewenangan / Tugas Kolektif / Jabatan Ex Officio / Kewajiban Pelaporan; null = tugas pokok tanpa pengelompokan.';

create trigger jobdesk_updated_at before update on public.jobdesk
  for each row execute function public.set_updated_at();

create view public.v_jobdesk with (security_invoker = true) as
select
  d.id, d.kode_dokumen, d.kelompok_unit, d.nama_jabatan, d.atasan_langsung, d.membawahi,
  d.pendidikan, d.pangkat, d.pengalaman_kerja, d.fungsi, d.file_sumber, d.urutan,
  j.id as jabatan_id, j.kode as jabatan_kode, j.nama as jabatan_nama,
  (select count(*) from public.jobdesk_tugas t where t.jobdesk_id = d.id)::int as jumlah_tugas
from public.jobdesk d
left join public.jabatan j on j.id = d.jabatan_id;

alter table public.jobdesk enable row level security;
alter table public.jobdesk_tugas enable row level security;
create policy "baca jobdesk" on public.jobdesk for select to anon, authenticated using (true);
create policy "baca jobdesk_tugas" on public.jobdesk_tugas for select to anon, authenticated using (true);

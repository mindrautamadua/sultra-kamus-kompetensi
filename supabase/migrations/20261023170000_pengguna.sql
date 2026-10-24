-- Akun login aplikasi (tanpa Supabase Auth). Hanya dibaca/ditulis server memakai service role:
-- RLS aktif tanpa policy dan hak anon/authenticated dicabut, jadi hash password tidak terbaca lewat API publik.

create table public.pengguna (
  id              bigint generated always as identity primary key,
  username        text not null unique check (username = lower(username) and username ~ '^[a-z0-9._-]{3,32}$'),
  nama            text not null,
  password_hash   text not null,
  aktif           boolean not null default true,
  gagal_login     smallint not null default 0,
  terkunci_sampai timestamptz,
  terakhir_login  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.pengguna is 'Akun login aplikasi. Kelola lewat `npm run pengguna`, bukan lewat API.';
comment on column public.pengguna.password_hash is 'scrypt$N$r$p$salt$hash (base64url), lihat src/lib/password.ts.';
comment on column public.pengguna.terkunci_sampai is 'Diisi setelah 5 kali gagal login berturut-turut (kunci 15 menit).';

create trigger pengguna_updated_at before update on public.pengguna
  for each row execute function public.set_updated_at();

alter table public.pengguna enable row level security;
revoke all on public.pengguna from anon, authenticated;

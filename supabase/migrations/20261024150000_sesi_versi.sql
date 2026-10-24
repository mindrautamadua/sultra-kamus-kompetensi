-- Pencabutan sesi: cookie sesi membawa sesi_versi saat login. Mengganti/mereset password atau menonaktifkan akun
-- menaikkan versi (lewat trigger, jadi berlaku juga untuk scripts/db/pengguna.mjs), sehingga semua sesi lama ditolak.

alter table public.pengguna add column sesi_versi int not null default 0;
comment on column public.pengguna.sesi_versi is 'Naik saat password berubah atau akun dinonaktifkan; token sesi dengan versi lain ditolak (src/lib/auth.ts, src/proxy.ts).';

create function public.pengguna_sesi_versi() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.password_hash is distinct from old.password_hash or (old.aktif and not new.aktif) then
    new.sesi_versi := old.sesi_versi + 1;
  end if;
  return new;
end $$;

create trigger pengguna_sesi_versi before update on public.pengguna
  for each row execute function public.pengguna_sesi_versi();

-- Hitung gagal login secara atomik: percobaan paralel tidak saling menimpa hitungan sehingga batas kunci tidak bisa dilewati.
create function public.catat_gagal_login(p_id bigint, p_batas int, p_menit int) returns void
language sql set search_path = '' as $$
  update public.pengguna set
    gagal_login     = case when gagal_login + 1 >= p_batas then 0 else gagal_login + 1 end,
    terkunci_sampai = case when gagal_login + 1 >= p_batas then now() + make_interval(mins => p_menit) else terkunci_sampai end
  where id = p_id;
$$;

revoke all on function public.pengguna_sesi_versi() from public, anon, authenticated;
revoke all on function public.catat_gagal_login(bigint, int, int) from public, anon, authenticated;
grant execute on function public.catat_gagal_login(bigint, int, int) to service_role;

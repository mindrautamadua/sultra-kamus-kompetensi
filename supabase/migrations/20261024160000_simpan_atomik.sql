-- Penyimpanan editor yang menghapus lalu menyisipkan ulang baris dijalankan dalam satu fungsi (= satu transaksi),
-- agar kegagalan di tengah jalan tidak meninggalkan tugas, pemetaan, atau indikator yang terhapus.
-- Hanya dipanggil server (service role) dari src/lib/actions.ts.

-- Uraian tugas satu jobdesk. p_tugas: [{kategori, deskripsi, asal}], asal = urutan lama butir itu (null = butir baru).
-- Butir lama diperbarui di tempat, bukan dihapus-sisip, agar kolom hasil analisis (tanpa_kompetensi, dsb.) ikut
-- butirnya. Bukti pemetaan jabatan (nomor urut tugas) dipindah ke nomor baru; nomor milik butir yang dihapus dibuang.
create function public.simpan_tugas_jobdesk(p_jobdesk_id bigint, p_jabatan_id bigint, p_tugas jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  delete from public.jobdesk_tugas t
  where t.jobdesk_id = p_jobdesk_id
    and not exists (select 1 from jsonb_array_elements(p_tugas) x(v) where (x.v->>'asal')::smallint = t.urutan);

  -- nomor lama digeser ke negatif dulu agar unique (jobdesk_id, urutan) tidak bentrok saat penomoran ulang
  update public.jobdesk_tugas set urutan = -urutan where jobdesk_id = p_jobdesk_id;
  update public.jobdesk_tugas t set urutan = x.ord, kategori = nullif(x.v->>'kategori', ''), deskripsi = x.v->>'deskripsi'
  from jsonb_array_elements(p_tugas) with ordinality x(v, ord)
  where t.jobdesk_id = p_jobdesk_id and t.urutan = -((x.v->>'asal')::smallint);

  -- butir baru, atau butir lama yang sudah tidak ada (dihapus dari tab lain)
  insert into public.jobdesk_tugas (jobdesk_id, urutan, kategori, deskripsi)
  select p_jobdesk_id, x.ord, nullif(x.v->>'kategori', ''), x.v->>'deskripsi'
  from jsonb_array_elements(p_tugas) with ordinality x(v, ord)
  where not exists (select 1 from public.jobdesk_tugas t where t.jobdesk_id = p_jobdesk_id and t.urutan = x.ord);

  update public.jabatan_kompetensi jk set bukti = coalesce((
    select array_agg(t.ord::smallint order by t.ord)
    from jsonb_array_elements(p_tugas) with ordinality t(v, ord)
    where (t.v->>'asal')::smallint = any(jk.bukti)
  ), '{}')
  where jk.jabatan_id = p_jabatan_id and jk.bukti <> '{}';
end $$;

-- Seluruh pemetaan kompetensi satu jabatan. p_rows: [{kompetensi_id, level_target, catatan, metode, bukti}].
create function public.simpan_pemetaan(p_jabatan_id bigint, p_rows jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  delete from public.jabatan_kompetensi where jabatan_id = p_jabatan_id;
  insert into public.jabatan_kompetensi (jabatan_id, kompetensi_id, level_target, sumber, catatan, metode, bukti)
  select p_jabatan_id, r.kompetensi_id, r.level_target, 'manual', r.catatan, r.metode, coalesce(r.bukti, '{}')
  from jsonb_to_recordset(p_rows) as r(kompetensi_id bigint, level_target smallint, catatan text, metode text, bukti smallint[]);
end $$;

-- Satu kompetensi beserta level & indikatornya. p_levels: [{level, nama_level, deskripsi, indikator: [teks]}];
-- level tanpa deskripsi maupun indikator dihapus. Mengembalikan kode kompetensi.
create function public.simpan_kompetensi(p_id bigint, p_nama text, p_definisi text, p_status text, p_catatan text[], p_levels jsonb) returns text
language plpgsql set search_path = '' as $$
declare
  v_kode text;
  v_level_id bigint;
  lv record;
begin
  update public.kompetensi set nama = p_nama, definisi = p_definisi, status = p_status, catatan = p_catatan, diubah_di_aplikasi = now()
  where id = p_id returning kode into v_kode;
  if v_kode is null then
    raise exception 'Kompetensi % tidak ditemukan', p_id;
  end if;

  for lv in select * from jsonb_to_recordset(p_levels) as x(level smallint, nama_level text, deskripsi text, indikator text[]) loop
    if lv.deskripsi is null and coalesce(cardinality(lv.indikator), 0) = 0 then
      delete from public.kompetensi_level where kompetensi_id = p_id and level = lv.level;
      continue;
    end if;
    insert into public.kompetensi_level (kompetensi_id, level, nama_level, deskripsi)
    values (p_id, lv.level, lv.nama_level, lv.deskripsi)
    on conflict (kompetensi_id, level) do update set nama_level = excluded.nama_level, deskripsi = excluded.deskripsi
    returning id into v_level_id;
    delete from public.indikator_perilaku where kompetensi_level_id = v_level_id;
    insert into public.indikator_perilaku (kompetensi_level_id, urutan, deskripsi)
    select v_level_id, i.ord, i.d from unnest(lv.indikator) with ordinality i(d, ord);
  end loop;
  return v_kode;
end $$;

revoke all on function public.simpan_tugas_jobdesk(bigint, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.simpan_pemetaan(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.simpan_kompetensi(bigint, text, text, text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.simpan_tugas_jobdesk(bigint, bigint, jsonb) to service_role;
grant execute on function public.simpan_pemetaan(bigint, jsonb) to service_role;
grant execute on function public.simpan_kompetensi(bigint, text, text, text, text[], jsonb) to service_role;

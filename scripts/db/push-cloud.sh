#!/usr/bin/env bash
# Pindahkan skema + seluruh data (skema public) dari Supabase lokal ke Supabase cloud.
# Tujuan diambil dari SUPABASE_DB_URL_CLOUD di .env.local (URI session pooler).
# Hanya untuk cloud yang skema public-nya MASIH KOSONG: skrip berhenti bila sudah ada tabel.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DBURL="$(grep '^SUPABASE_DB_URL_CLOUD=' "$ROOT/.env.local" | cut -d= -f2-)"
[ -n "$DBURL" ] || { echo "SUPABASE_DB_URL_CLOUD belum diisi di .env.local"; exit 1; }
LOCAL=(docker exec -e PGPASSWORD=postgres supabase_db_kamus-kompetensi)

ada=$(psql "$DBURL" -At -c "select count(*) from information_schema.tables where table_schema = 'public'")
if [ "$ada" != "0" ]; then
  echo "Cloud sudah berisi $ada tabel/view di skema public — dibatalkan agar tidak menimpa data."; exit 1
fi

echo "== 1/3 Terapkan migrasi =="
(cd "$ROOT" && npx supabase db push --db-url "$DBURL" --yes)

echo "== 2/3 Salin data =="
DUMP="$ROOT/supabase/backup/cloud-push-$(date +%Y%m%d-%H%M%S).sql"
mkdir -p "$ROOT/supabase/backup"
# tanpa --disable-triggers: role postgres di cloud bukan superuser. Urutan tabel diatur pg_dump;
# referensi ke baris di tabel yang sama (parent_id, atasan_id) diperiksa di akhir tiap COPY.
"${LOCAL[@]}" pg_dump -h 127.0.0.1 -U supabase_admin -d postgres --data-only --schema=public > "$DUMP"
grep -q "PostgreSQL database dump complete" "$DUMP" || { echo "dump lokal tidak lengkap"; exit 1; }
psql "$DBURL" -v ON_ERROR_STOP=1 --single-transaction -q -f "$DUMP"

echo "== 3/3 Cocokkan jumlah baris =="
SQL="select string_agg(format('%s=%s', table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text), ' ' order by table_name)
     from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
lokal=$("${LOCAL[@]}" psql -h 127.0.0.1 -U supabase_admin -d postgres -At -c "$SQL")
cloud=$(psql "$DBURL" -At -c "$SQL")
echo "$cloud" | tr ' ' '\n'
if [ "$lokal" = "$cloud" ]; then echo "OK: jumlah baris lokal = cloud"; else echo "BEDA dengan lokal:"; echo "$lokal" | tr ' ' '\n'; exit 1; fi

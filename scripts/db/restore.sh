#!/usr/bin/env bash
# Pulihkan data dari file backup: skema dibuat ulang dari migration (tanpa seed), lalu data dimuat dari backup.
# Pemakaian: npm run db:restore -- supabase/backup/data-YYYYMMDD-HHMMSS.sql   (tanpa argumen = backup terbaru)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="${1:-$(ls -t "$ROOT"/supabase/backup/data-*.sql 2>/dev/null | head -1)}"
[ -f "$FILE" ] || { echo "file backup tidak ditemukan: ${FILE:-supabase/backup/data-*.sql}"; exit 1; }
# jangan sampai database dikosongkan oleh file yang rusak/kosong
grep -q "PostgreSQL database dump complete" "$FILE" && grep -q "COPY public.jabatan " "$FILE" ||
  { echo "file backup tidak valid (dump tidak lengkap): $FILE — database TIDAK diubah"; exit 1; }
echo "memulihkan dari $FILE"
cd "$ROOT" && npx supabase db reset --no-seed
docker exec -i -e PGPASSWORD=postgres supabase_db_kamus-kompetensi psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q < "$FILE"
echo "selesai"

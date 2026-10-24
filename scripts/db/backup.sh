#!/usr/bin/env bash
# Simpan seluruh isi data (skema public) database lokal ke supabase/backup/data-<tanggal>.sql.
# Jalankan SEBELUM `npm run db:reset` bila ada perubahan yang dibuat lewat halaman edit aplikasi.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/supabase/backup/data-$(date +%Y%m%d-%H%M%S).sql"
mkdir -p "$ROOT/supabase/backup"
# supabase_admin (superuser lokal, password bawaan "postgres") diperlukan untuk --disable-triggers
if ! docker exec -e PGPASSWORD=postgres supabase_db_kamus-kompetensi \
  pg_dump -h 127.0.0.1 -U supabase_admin -d postgres --data-only --schema=public --disable-triggers > "$OUT"; then
  rm -f "$OUT"; echo "backup GAGAL"; exit 1
fi
grep -q "PostgreSQL database dump complete" "$OUT" || { rm -f "$OUT"; echo "backup GAGAL: dump tidak lengkap"; exit 1; }
echo "backup: $OUT ($(du -h "$OUT" | cut -f1))"

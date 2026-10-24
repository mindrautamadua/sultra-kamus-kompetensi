#!/usr/bin/env bash
# Parse sumber-data -> supabase/data/*.json -> supabase/seed.sql
# Lalu jalankan `npx supabase db reset` (atau `npm run db:reset`) untuk memuat ulang database lokal.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VENV="$ROOT/scripts/etl/.venv"

if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q -r "$ROOT/scripts/etl/requirements.txt"
fi
PY="$VENV/bin/python -I"

$PY "$ROOT/scripts/etl/parse_kompetensi.py" "$ROOT/sumber-data" "$ROOT/supabase/data/kompetensi.json"
$PY "$ROOT/scripts/etl/parse_jobdesk.py" "$ROOT/sumber-data" "$ROOT/supabase/data/jobdesk.json"
# struktur jabatan 2026 dibangun dari dokumen jobdesk (parse_struktur_organisasi.py = bagan 2024, tidak dipakai lagi)
$PY "$ROOT/scripts/etl/build_struktur_2026.py" \
  "$ROOT/supabase/data/jobdesk.json" "$ROOT/sumber-data" "$ROOT/supabase/data/struktur_organisasi.json"
$PY "$ROOT/scripts/etl/build_pemetaan.py" "$ROOT/supabase/data/kompetensi.json" \
  "$ROOT/supabase/data/struktur_organisasi.json" "$ROOT/supabase/data/jobdesk.json" "$ROOT/supabase/data/pemetaan.json" \
  "$ROOT/supabase/data/pemetaan_ai.json"
$PY "$ROOT/scripts/etl/generate_seed.py" \
  "$ROOT/supabase/data/kompetensi.json" "$ROOT/supabase/data/struktur_organisasi.json" \
  "$ROOT/supabase/data/jobdesk.json" "$ROOT/supabase/data/pemetaan.json" "$ROOT/supabase/seed.sql"

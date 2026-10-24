"""Gabungkan hasil analisis AI per batch menjadi supabase/data/pemetaan_ai.json (dipakai build_pemetaan.py).

Analisis dilakukan sekali di luar aplikasi (Claude Code, tanpa API di aplikasi): setiap batch input berisi jobdesk
unik (`id`, `jabatan` = kode-kode jabatan pemakainya, `tugas` bernomor) dan setiap file hasil berisi
{id, kompetensi: [{kode, level, bukti, alasan}], tugas_tidak_tercakup, catatan}.

Usage: python -I gabung_pemetaan_ai.py <dir input batch> <dir hasil batch> <struktur_organisasi.json> <jobdesk.json> <out.json>
"""
import datetime
import glob
import json
import os
import sys

IN_DIR, OUT_DIR, ORG, JOB, OUT = sys.argv[1:6]
org = json.load(open(ORG))
jobdesk = {r['file']: r for r in json.load(open(JOB))['jobdesk']}
files = {j['kode']: j['files'][0] for j in org['jabatan'] if j['files']}

hasil = {}
for f in sorted(glob.glob(os.path.join(OUT_DIR, 'batch_*.json'))):
    for o in json.load(open(f)):
        hasil[o['id']] = o

per_jabatan, hilang = {}, []
for f in sorted(glob.glob(os.path.join(IN_DIR, 'batch_*.json'))):
    for g in json.load(open(f)):
        o = hasil.get(g['id'])
        if not o:
            hilang.append(g['id'])
            continue
        for kode in g['jabatan']:
            per_jabatan[kode] = dict(
                file=files[kode],
                # bukti merujuk nomor butir tugas; jumlahnya dipakai untuk mendeteksi jobdesk yang berubah sesudah analisis
                jumlah_tugas=len(g['tugas']),
                kompetensi=o['kompetensi'],
                tugas_tidak_tercakup=o.get('tugas_tidak_tercakup', []),
                catatan=o.get('catatan') or None,
            )

json.dump(dict(dibuat=datetime.date.today().isoformat(), metode='Analisis AI (Claude) atas jobdesk & kamus, ditinjau validator',
               jabatan=per_jabatan), open(OUT, 'w'), ensure_ascii=False, indent=1)
print(f'pemetaan AI: {len(per_jabatan)} jabatan dari {len(hasil)} jobdesk; belum ada hasil: {len(hilang)}')

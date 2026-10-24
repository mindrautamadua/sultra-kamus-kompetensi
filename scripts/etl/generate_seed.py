"""Generate supabase/seed.sql from the parsed JSON files.

Usage: python -I generate_seed.py <kompetensi.json> <struktur_organisasi.json> <jobdesk.json> <pemetaan.json> <seed.sql> [tanpa_kode_ai.json]
"""
import json
import os
import sys

KOMP, ORG, JOB, MAP, OUT = sys.argv[1:6]
TANPA = sys.argv[6] if len(sys.argv) > 6 and os.path.exists(sys.argv[6]) else None
k = json.load(open(KOMP))
o = json.load(open(ORG))
jd = json.load(open(JOB))['jobdesk']
pm = json.load(open(MAP))


def q(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return 'array[' + ', '.join(q(x) for x in v) + ']::text[]' if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"


def values(rows):
    return ',\n'.join('  (' + ', '.join(q(c) for c in r) + ')' for r in rows)


out = ['-- AUTO-GENERATED oleh scripts/etl/generate_seed.py — jangan edit manual.',
       '-- Sumber: folder sumber-data (kamus kompetensi .docx & struktur organisasi .pdf)', '']

# ---- bidang
files = {}
for r in k['kompetensi']:
    files.setdefault(r['prefix'], r['file'])
rows = [(kode, nama, kat, files.get(kode), i) for i, (kode, (nama, kat)) in enumerate(k['bidang'].items(), 1)]
out.append('insert into public.bidang_kompetensi (kode, nama, kategori, file_sumber, urutan) values')
out.append(values(rows) + ';\n')

# ---- kompetensi
rows = [(r['kode'], r['prefix'], r['nama'], r.get('nama_daftar_isi'), r['definisi'], r['status'], r['tanda_c'],
         r['catatan'], r['kode_dokumen'], r['file'], i) for i, r in enumerate(k['kompetensi'], 1)]
out.append('insert into public.kompetensi (kode, bidang_id, nama, nama_daftar_isi, definisi, status, tanda_c, catatan,'
           ' kode_dokumen, file_sumber, urutan)')
out.append('select v.kode, b.id, v.nama, v.nama_daftar_isi, v.definisi, v.status, v.tanda_c, v.catatan, v.kode_dokumen,'
           ' v.file_sumber, v.urutan from (values')
out.append(values(rows))
out.append(') v(kode, bidang, nama, nama_daftar_isi, definisi, status, tanda_c, catatan, kode_dokumen, file_sumber, urutan)')
out.append('join public.bidang_kompetensi b on b.kode = v.bidang;\n')

# ---- level
rows = [(r['kode'], l['level'], l['nama_level'], l['deskripsi'] or None) for r in k['kompetensi'] for l in r['levels']]
out.append('insert into public.kompetensi_level (kompetensi_id, level, nama_level, deskripsi)')
out.append('select k.id, v.level, v.nama_level, v.deskripsi from (values')
out.append(values(rows))
out.append(') v(kode, level, nama_level, deskripsi) join public.kompetensi k on k.kode = v.kode;\n')

# ---- indikator
rows = [(r['kode'], l['level'], i, ind) for r in k['kompetensi'] for l in r['levels']
        for i, ind in enumerate(l['indikator'], 1)]
out.append('insert into public.indikator_perilaku (kompetensi_level_id, urutan, deskripsi)')
out.append('select l.id, v.urutan, v.deskripsi from (values')
out.append(values(rows))
out.append(') v(kode, level, urutan, deskripsi)')
out.append('join public.kompetensi k on k.kode = v.kode')
out.append('join public.kompetensi_level l on l.kompetensi_id = k.id and l.level = v.level;\n')

# ---- referensi lintas bidang
rows = [(r['kode'], r['bidang_prefix'], r['catatan']) for r in k['referensi']]
if rows:
    out.append('insert into public.kompetensi_bidang_terkait (kompetensi_id, bidang_id, catatan)')
    out.append('select k.id, b.id, v.catatan from (values')
    out.append(values(rows))
    out.append(') v(kode, bidang, catatan)')
    out.append('join public.kompetensi k on k.kode = v.kode join public.bidang_kompetensi b on b.kode = v.bidang;\n')

# ---- unit kerja
rows = [(u['kode'], u['nama'], u['jenis'], u['direktorat'], u['catatan'], u['urutan']) for u in o['unit_kerja']]
out.append('insert into public.unit_kerja (kode, nama, jenis, direktorat, catatan, urutan) values')
out.append(values(rows) + ';\n')
rows = [(u['kode'], u['parent_kode']) for u in o['unit_kerja'] if u['parent_kode']]
out.append('update public.unit_kerja u set parent_id = p.id from (values')
out.append(values(rows))
out.append(') v(kode, parent) join public.unit_kerja p on p.kode = v.parent where u.kode = v.kode;\n')

# ---- jabatan
rows = [(j['kode'], j['nama'], j['nama_asli'], j['unit_kode'], j['jenjang'], j['kelompok'], j['catatan'], j['urutan'])
        for j in o['jabatan']]
out.append('insert into public.jabatan (kode, nama, nama_asli, unit_kerja_id, jenjang, kelompok_jabatan, catatan, urutan)')
out.append('select v.kode, v.nama, v.nama_asli, u.id, v.jenjang, v.kelompok, v.catatan, v.urutan from (values')
out.append(values(rows))
out.append(') v(kode, nama, nama_asli, unit, jenjang, kelompok, catatan, urutan)')
out.append('join public.unit_kerja u on u.kode = v.unit;\n')
rows = [(j['kode'], j['atasan_kode']) for j in o['jabatan'] if j['atasan_kode']]
out.append('update public.jabatan j set atasan_id = a.id from (values')
out.append(values(rows))
out.append(') v(kode, atasan) join public.jabatan a on a.kode = v.atasan where j.kode = v.kode;\n')

# ---- kotak bagan tanpa jobdesk
units_by_nama = {u['nama']: u['kode'] for u in o['unit_kerja']}
rows = [(units_by_nama[b['unit']], b['label'], b['file'], i) for i, b in enumerate(o.get('bagan_tanpa_jobdesk', []), 1)]
if rows:
    out.append('insert into public.bagan_tanpa_jobdesk (unit_kerja_id, label, file_sumber, urutan)')
    out.append('select u.id, v.label, v.file_sumber, v.urutan from (values')
    out.append(values(rows))
    out.append(') v(unit, label, file_sumber, urutan) join public.unit_kerja u on u.kode = v.unit;\n')

# ---- jobdesk (jabatan dibangun dari dokumen jobdesk; files[0] = dokumen utama jabatan)
jab_file = {f: (j['kode'], j['urutan'] + i / 10) for j in o['jabatan'] for i, f in enumerate(j['files'])}
jd.sort(key=lambda r: jab_file[r['file']][1])
for r in jd:
    r['jabatan_kode'] = jab_file[r['file']][0]

rows = [(r['kode_dokumen'], r['folder'], r['nama_jabatan'], r['atasan_langsung'], r['membawahi'], r['pendidikan'],
         r['pendidikan_tambahan'], r['pangkat'], r['pengalaman_kerja'], r['kompetensi'], r['fungsi'],
         r['jabatan_kode'], r['file'], i) for i, r in enumerate(jd, 1)]
out.append('insert into public.jobdesk (kode_dokumen, kelompok_unit, nama_jabatan, atasan_langsung, membawahi, pendidikan,'
           ' pendidikan_tambahan, pangkat, pengalaman_kerja, kompetensi, fungsi, jabatan_id, file_sumber, urutan)')
out.append('select v.kode_dokumen, v.kelompok_unit, v.nama_jabatan, v.atasan_langsung, v.membawahi, v.pendidikan,'
           ' v.pendidikan_tambahan, v.pangkat, v.pengalaman_kerja, v.kompetensi, v.fungsi, j.id, v.file_sumber, v.urutan'
           ' from (values')
out.append(values(rows))
out.append(') v(kode_dokumen, kelompok_unit, nama_jabatan, atasan_langsung, membawahi, pendidikan, pendidikan_tambahan,'
           ' pangkat, pengalaman_kerja, kompetensi, fungsi, jabatan, file_sumber, urutan)')
out.append('left join public.jabatan j on j.kode = v.jabatan;\n')

rows = [(r['file'], i, t['kategori'], t['deskripsi']) for r in jd for i, t in enumerate(r['tugas'], 1)]
out.append('insert into public.jobdesk_tugas (jobdesk_id, urutan, kategori, deskripsi)')
out.append('select d.id, v.urutan, v.kategori, v.deskripsi from (values')
out.append(values(rows))
out.append(') v(file_sumber, urutan, kategori, deskripsi) join public.jobdesk d on d.file_sumber = v.file_sumber;\n')

# jabatan yang punya padanan jobdesk: isi ikhtisar & uraian tugas dari dokumen pertama (urutan folder)
out.append('update public.jabatan j set ikhtisar_jabatan = array_to_string(d.fungsi, E\'\\n\'),')
out.append('  uraian_tugas = array(select t.deskripsi from public.jobdesk_tugas t where t.jobdesk_id = d.id order by t.urutan)')
out.append('from (select distinct on (jabatan_id) * from public.jobdesk where jabatan_id is not null'
           ' order by jabatan_id, urutan) d')
out.append('where j.id = d.jabatan_id;\n')

# ---- pemetaan kompetensi usulan
rows = [(r['jabatan_kode'], r['kompetensi_kode'], r['level_target'], r['skor'], r['catatan'], r['metode'],
         '{' + ','.join(map(str, r['bukti'])) + '}') for r in pm['pemetaan']]
out.append('insert into public.jabatan_kompetensi (jabatan_id, kompetensi_id, level_target, sumber, skor, catatan, metode, bukti)')
out.append("select j.id, k.id, v.level_target, 'usulan', v.skor::real, v.catatan, v.metode, v.bukti::smallint[] from (values")
out.append(values(rows))
out.append(') v(jabatan, kompetensi, level_target, skor, catatan, metode, bukti)')
out.append('join public.jabatan j on j.kode = v.jabatan join public.kompetensi k on k.kode = v.kompetensi;\n')

# butir tugas inti tanpa padanan kamus (hasil analisis AI)
rows = [(t['file'], t['urutan']) for t in pm['tugas_tanpa_kompetensi']]
if rows:
    out.append('update public.jobdesk_tugas t set tanpa_kompetensi = true from (values')
    out.append(values(rows))
    out.append(') v(file_sumber, urutan) join public.jobdesk d on d.file_sumber = v.file_sumber')
    out.append('where t.jobdesk_id = d.id and t.urutan = v.urutan;')

# alasan per butir tanpa kode (analisis AI ulang); celah menggantikan tanda tanpa_kompetensi di atas
if TANPA:
    rows = [(t['file'], t['urutan'], t['alasan'], t['saran'], t['catatan']) for t in json.load(open(TANPA))['butir']]
    out.append('\nupdate public.jobdesk_tugas t set alasan_tanpa_kode = v.alasan, saran_kompetensi = v.saran,')
    out.append("  catatan_tanpa_kode = v.catatan, tanpa_kompetensi = v.alasan = 'celah' from (values")
    out.append(values(rows))
    out.append(') v(file_sumber, urutan, alasan, saran, catatan) join public.jobdesk d on d.file_sumber = v.file_sumber')
    out.append('where t.jobdesk_id = d.id and t.urutan = v.urutan;')

open(OUT, 'w').write('\n'.join(out) + '\n')
print('seed written:', OUT)

"""Build unit kerja + jabatan (struktur Perubahan Ketiga 2026) from the parsed jobdesk documents.

One jobdesk document = one jabatan. The atasan comes from the "Atasan Langsung" text (matched by name
within the same folder); the document number (14 -> 14.A -> 14.A.1) is only a fallback because its
numbering has gaps. The per-folder org charts (STRUKTUR *.pdf, draw.io export with the XML in the
PDF metadata) are read only to list boxes that have no jobdesk yet.

Usage: python -I build_struktur_2026.py <jobdesk.json> <sumber-data dir> <out.json>
"""
import difflib
import glob
import html
import json
import os
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET

import pdfplumber

JOB, SRC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
jd = json.load(open(JOB))['jobdesk']

# folder -> (kode unit, nama unit, jenis)
FOLDER = {
    '1. Cabang Utama': ('KCU', 'Kantor Cabang Utama', 'kantor'),
    '2. Cabang TIPE 1 (SME)': ('KC', 'Kantor Cabang Tipe 1 (SME)', 'kantor'),
    '3. Cabang Pembantu TIPE 1 (TOWER)': ('KCP1', 'Kantor Cabang Pembantu Tipe 1 (Tower)', 'kantor'),
    '3. Cabang Pembantu TIPE 2 (SME)': ('KCP2', 'Kantor Cabang Pembantu Tipe 2 (SME)', 'kantor'),
    '3. Cabang Pembantu TIPE 3 (NON SME)': ('KCP3', 'Kantor Cabang Pembantu Tipe 3 (Non SME)', 'kantor'),
    '4. DIVISI PERENCANAAN': ('D04', 'Divisi Perencanaan', 'divisi'),
    '5. DIVISI CORPORATE SECRETARY': ('D05', 'Divisi Corporate Secretary', 'divisi'),
    '6. BAGIAN HUKUM & LITIGASI': ('D06', 'Bagian Hukum & Litigasi', 'bagian'),
    '7. DIVISI OPERASIONAL KREDIT': ('D07', 'Divisi Operasional Kredit', 'divisi'),
    '8. DIVISI KREDIT MENENGAH, KOMERSIAL,KORPORASI & HUBUNGAN KELEMBAGAAN':
        ('D08', 'Divisi Kredit Menengah, Komersial, Korporasi & Hubungan Kelembagaan', 'divisi'),
    '9. DIVISI KREDIT KONSUMTIF & MIKRO': ('D09', 'Divisi Kredit Konsumtif & Mikro', 'divisi'),
    '10. DIVISI KEPATUHAN,APU PPT & PPPSPM': ('D10', 'Divisi Kepatuhan, APU PPT & PPPSPM', 'divisi'),
    '11. DIVISI MANAJEMEN RISIKO': ('D11', 'Divisi Manajemen Risiko', 'divisi'),
    '12. DIVISI PEMASARAN DANA & JASA': ('D12', 'Divisi Pemasaran Dana & Jasa', 'divisi'),
    '13. DIVISI TEKNOLOGI INFORMASI': ('D13', 'Divisi Teknologi Informasi', 'divisi'),
    '14. DIVISI HUMAN CAPITAL': ('D14', 'Divisi Human Capital', 'divisi'),
    '15. DIVISI OPERASIONAL & LAYANAN': ('D15', 'Divisi Operasional & Layanan', 'divisi'),
    '16. DIVISI KEUANGAN & AKUNTANSI': ('D16', 'Divisi Keuangan & Akuntansi', 'divisi'),
    '17. DIVISI TREASURY': ('D17', 'Divisi Treasury', 'divisi'),
    '18. DIVISI UMUM': ('D18', 'Divisi Umum', 'divisi'),
    '19. SATUAN KERJA AUDIT INTERNAL (SKAI)': ('D19', 'Satuan Kerja Audit Internal', 'divisi'),
    '20. BAGIAN CISO & PDP': ('D20', 'Bagian CISO & PDP', 'bagian'),
    '21. KANTOR FUNGSIONAL': ('KF', 'Kantor Fungsional', 'kantor'),
}


def norm(s):
    s = re.sub(r'\([^)]*\)', '', s.lower().replace('&', ' dan '))
    s = re.sub(r'\bkordinator\b', 'koordinator', s)
    return ' '.join(re.sub(r'[^a-z0-9]', ' ', s).split())


def kode_key(k):
    return [(0, int(x), '') if x.isdigit() else (1, 0, x) for x in k.split('.')]


def jenjang(nama):
    n = nama.lower()
    if n.startswith('direktur'):
        return 0
    if n.startswith(('pemimpin', 'kepala divisi', 'kepala satuan')):
        return 1
    if n.startswith(('kepala bagian', 'ketua')):
        return 2
    if n.startswith(('kepala seksi', 'koordinator', 'head teller')):
        return 3
    return 4


def kelompok(nama):
    n = nama.lower()
    for p, k in [('direktur', 'Direksi'), ('pemimpin', 'Pemimpin Kantor'), ('kepala divisi', 'Kepala Divisi'),
                 ('kepala satuan', 'Kepala Divisi'), ('kepala bagian', 'Kepala Bagian'), ('ketua', 'Ketua Kelompok'),
                 ('kepala seksi', 'Kepala Seksi'), ('koordinator', 'Koordinator'), ('head teller', 'Koordinator')]:
        if n.startswith(p):
            return k
    return 'Pelaksana'


units, jabatan = [], []


def add_unit(kode, nama, jenis, parent, direktorat=None, catatan=None):
    units.append(dict(kode=kode, nama=nama, jenis=jenis, parent_kode=parent, direktorat=direktorat,
                      urutan=len(units) + 1, catatan=catatan))


add_unit('DIR', 'Direksi', 'direksi', None)
DIREKSI = ['Direktur Utama', 'Direktur Bisnis', 'Direktur TI & Operasional', 'Direktur Umum', 'Direktur Kepatuhan']
for i, n in enumerate(DIREKSI):
    jabatan.append(dict(kode=f'DIR-{i + 1}', nama=n, unit_kode='DIR', jenjang=0, kelompok='Direksi',
                        atasan_kode=None if i == 0 else 'DIR-1', nama_asli=None, urutan=len(jabatan) + 1,
                        catatan=None, files=[]))
dir_by_norm = {norm(j['nama']): j['kode'] for j in jabatan}

# ---- jabatan dari dokumen jobdesk (dokumen ganda dgn nomor & nama sama -> satu jabatan)
by_folder = {}
for r in jd:
    by_folder.setdefault(r['folder'], []).append(r)
unknown = sorted(set(by_folder) - set(FOLDER))
assert not unknown, f'folder belum dipetakan: {unknown}'

for folder, (ukode, unama, ujenis) in FOLDER.items():
    docs = sorted(by_folder.get(folder, []), key=lambda r: (kode_key(r['kode_dokumen']), r['file']))
    head = min(docs, key=lambda r: (jenjang(r['nama_jabatan']), kode_key(r['kode_dokumen'])))
    atasan_head = dir_by_norm.get(norm(head['atasan_langsung'] or ''))
    add_unit(ukode, unama, ujenis, 'DIR', DIREKSI[int(atasan_head[4:]) - 1] if atasan_head else None)
    recs = {}
    for r in docs:
        k = (r['kode_dokumen'], norm(r['nama_jabatan']))
        if k in recs:
            recs[k]['files'].append(r['file'])
            continue
        kode = f'{ukode}-{r["kode_dokumen"]}'
        recs[k] = dict(kode=kode, nama=r['nama_jabatan'], unit_kode=ukode, jenjang=jenjang(r['nama_jabatan']),
                       kelompok=kelompok(r['nama_jabatan']), atasan_kode=None, nama_asli=None,
                       urutan=0, catatan=None, files=[r['file']], _doc=r)
    fj = list(recs.values())
    assert len({j['kode'] for j in fj}) == len(fj), folder
    # dokumen ganda: utamakan file yang namanya memuat nama jabatan
    for j in fj:
        j['files'].sort(key=lambda f: norm(j['nama']) not in norm(os.path.basename(f)))

    # sub-unit: setiap Kepala Bagian/Seksi/Ketua (selain kepala unit) membentuk unit di bawahnya
    for j in fj:
        if j is recs[(head['kode_dokumen'], norm(head['nama_jabatan']))]:
            j['_unit'] = ukode
            continue
        m = re.match(r'^(Kepala Bagian|Kepala Seksi|Ketua(?: Tim| Kelompok)?)\s+(.*)$', j['nama'], re.I)
        if m:
            jenis = {'kepala bagian': 'bagian', 'kepala seksi': 'seksi'}.get(m.group(1).lower(), 'kelompok')
            j['_subunit'] = (jenis, {'bagian': 'Bagian', 'seksi': 'Seksi', 'kelompok': 'Kelompok'}[jenis] + ' ' +
                             m.group(2))

    # atasan: teks "Atasan Langsung" dicocokkan ke jabatan lain di folder yang sama, lalu nomor dokumen
    names = {norm(j['nama']): j for j in fj}
    for j in fj:
        d = j['_doc']
        at = None
        for part in re.split(r'\s*/\s*', d['atasan_langsung'] or ''):
            p = norm(part)
            if p in dir_by_norm:
                at = dir_by_norm[p]
                break
            cand = [x for x in names if x != norm(j['nama']) and names[x]['jenjang'] <= j['jenjang']]
            best = difflib.get_close_matches(p, cand, n=1, cutoff=0.85)
            if best:
                at = names[best[0]]['kode']
                break
        if at is None and j['jenjang'] > 1 and j['_doc'] is not head:
            parts = d['kode_dokumen'].split('.')
            while len(parts) > 1 and at is None:
                parts = parts[:-1]
                at = next((x['kode'] for x in fj if x['_doc']['kode_dokumen'] == '.'.join(parts)), None)
            at = at or recs[(head['kode_dokumen'], norm(head['nama_jabatan']))]['kode']
            j['catatan'] = f'Atasan "{d["atasan_langsung"]}" tidak ditemukan di folder; diambil dari nomor dokumen.'
        if at is None and j['_doc'] is head and d['atasan_langsung']:
            j['catatan'] = f'Atasan langsung: {d["atasan_langsung"]}.'
        j['atasan_kode'] = at

    # unit tiap jabatan: kepala sub-unit membuat unit di bawah unit atasannya; lainnya ikut unit atasan
    byk = {j['kode']: j for j in fj}

    def unit_of(j, seen=()):
        if '_unit' in j:
            return j['_unit']
        at = byk.get(j['atasan_kode'])
        parent_unit = unit_of(at, seen + (j['kode'],)) if at and at['kode'] not in seen else ukode
        if '_subunit' in j:
            jenis, nama = j['_subunit']
            uk = f'{ukode}-{len([u for u in units if u["kode"].startswith(ukode + "-")]) + 1:02d}'
            add_unit(uk, nama, jenis, parent_unit)
            j['_unit'] = uk
        else:
            j['_unit'] = parent_unit
        return j['_unit']

    for j in fj:
        j['unit_kode'] = unit_of(j)
    for j in fj:
        for k in [k for k in j if k.startswith('_')]:
            del j[k]
        j['urutan'] = len(jabatan) + 1
        jabatan.append(j)


# ---- cek silang dengan bagan per folder: kotak jabatan tanpa dokumen jobdesk
def clean(v):
    v = re.sub(r'<br[^>]*>|</div>|</p>|<div[^>]*>', '\n', v or '')
    v = html.unescape(re.sub(r'<[^>]+>', '', v))
    return re.sub(r'\s+', ' ', ' '.join(x.strip() for x in v.split('\n') if x.strip())).strip()


JAB_PREFIX = re.compile(r'^(KEPALA|KETUA|KOORDINATOR|PELAKSANA|PEMIMPIN|RELATIONSHIP|HEAD|TELLER|CUSTOMER|SUNDRIES|'
                        r'VERIFIKASI)\b')
bagan = []
for f in sorted(glob.glob(os.path.join(SRC, '*', '*.pdf'))):
    folder = os.path.basename(os.path.dirname(f))
    if folder not in FOLDER or not ('STRUKTUR' in f.upper() or os.path.basename(f) == '15.DIVISI HUMAN CAPITAL.pdf'):
        continue
    with pdfplumber.open(f) as pdf:
        root = ET.fromstring(urllib.parse.unquote(pdf.metadata['Subject']))
    ada = [norm(j['nama']) for j in jabatan if j['unit_kode'].split('-')[0] == FOLDER[folder][0]]
    for c in root.iter('mxCell'):
        t = clean(c.get('value'))
        if c.get('vertex') != '1' or not JAB_PREFIX.match(t) or t.startswith(('KEPALA DIVISI', 'KEPALA SATUAN')):
            continue
        if not difflib.get_close_matches(norm(t), ada, n=1, cutoff=0.8):
            bagan.append(dict(unit=FOLDER[folder][1], label=t, file=os.path.relpath(f, SRC)))

for u in units:
    lab = [b['label'] for b in bagan if b['unit'] == u['nama']]
    if lab:
        u['catatan'] = 'Ada di bagan tetapi belum ada jobdesk (atau beda penamaan): ' + '; '.join(lab) + '.'

codes = {j['kode'] for j in jabatan}
assert all(j['atasan_kode'] is None or j['atasan_kode'] in codes for j in jabatan)
ucodes = {u['kode'] for u in units}
assert all(u['parent_kode'] is None or u['parent_kode'] in ucodes for u in units)

json.dump(dict(unit_kerja=units, jabatan=jabatan, bagan_tanpa_jobdesk=bagan), open(OUT, 'w'), ensure_ascii=False,
          indent=1)
print(f'struktur 2026: {len(units)} unit; {len(jabatan)} jabatan; {len(bagan)} kotak bagan tanpa jobdesk')

"""Extract unit kerja + jabatan from the org-chart PDF.

The PDF was exported from draw.io and still carries the full diagram XML in its
metadata (Subject), so the hierarchy is rebuilt from that XML instead of OCR/text.

Usage: python -I parse_struktur_organisasi.py <struktur.pdf> <out.json>
"""
import html
import json
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET

import pdfplumber

PDF, OUT = sys.argv[1], sys.argv[2]

with pdfplumber.open(PDF) as pdf:
    root = ET.fromstring(urllib.parse.unquote(pdf.metadata['Subject']))


def clean(v):
    v=re.sub(r'<br[^>]*>|</div>|</p>|<div[^>]*>','\n',v or '')
    v=re.sub(r'<[^>]+>','',v); v=html.unescape(v)
    v=' '.join(x.strip() for x in v.split('\n') if x.strip())
    return re.sub(r'\s+',' ',v).strip()
def pages():
    for dg in root.findall('diagram'):
        cells={c.get('id'):c for c in dg.findall('.//mxCell')}
        def geo(c):
            g=c.find('mxGeometry')
            if g is None: return 0,0,0,0
            f=lambda k:float(g.get(k) or 0)
            return f('x'),f('y'),f('width'),f('height')
        def absxy(cid):
            x=y=0; c=cells.get(cid)
            while c is not None and c.get('id') not in ('0','1'):
                gx,gy,_,_=geo(c); x+=gx;y+=gy; c=cells.get(c.get('parent'))
            return x,y
        nodes={}
        for cid,c in cells.items():
            if c.get('vertex')!='1': continue
            t=clean(c.get('value'))
            if not t or t.startswith('=') or t.startswith(('KETERANGAN','Perubahan Kedua','STRUKTUR ORGANISASI')): continue
            x,y=absxy(cid); _,_,w,h=geo(c)
            nodes[cid]=dict(id=cid,label=t,x=x,y=y,w=w,h=h,cx=x+w/2,cy=y+h/2)
        edges=[]
        for c in cells.values():
            if c.get('edge')=='1': edges.append((c.get('source'),c.get('target'),c.get('style') or ''))
        yield dg.get('name'),nodes,edges,cells

def rank(l):
    L = l.upper()
    if L.startswith(('KEPALA DIVISI', 'KEPALA SATUAN', 'PEMIMPIN', 'DIVISI')):
        return 1
    if L.startswith(('KEPALA BAGIAN', 'KETUA KELOMPOK')):
        return 2
    if L.startswith(('KEPALA SEKSI', 'KOORDINATOR', 'HEAD TELLER')):
        return 3
    return 4


def build_raw():
    """Per page: nodes with parent guessed from connector edges, else nearest higher-rank box above."""
    out = {}
    for name, nodes, edges, cells in pages():
        if name == 'utama':
            continue
        ns = list(nodes.values())
        for n in ns:
            n['rank'] = rank(n['label'])
        emap = {}
        for s, t, _ in edges:
            if s in nodes and t in nodes:
                a, b = nodes[s], nodes[t]
                if a['rank'] == b['rank']:
                    continue
                child, par = (a, b) if a['rank'] > b['rank'] else (b, a)
                emap.setdefault(child['id'], par['id'])
        for n in ns:
            if n['rank'] == 1:
                n['parent'] = None
                continue
            if n['id'] in emap:
                n['parent'] = emap[n['id']]
                continue
            cands = [c for c in ns if c['rank'] < n['rank'] and c['cy'] < n['cy'] and c['label'] != 'DIVISI PERKREDITAN']

            def score(c):
                return abs(c['cx'] - n['cx']) + 0.3 * (n['cy'] - c['cy']) + (n['rank'] - c['rank'] - 1) * 150
            best = min(cands, key=score) if cands else None
            n['parent'] = best['id'] if best else None
        out[name] = ns
    return out


raw = build_raw()
ACR = {'SDM', 'TSI', 'APU', 'PPT', 'PPPSPM', 'CTR', 'STR', 'RBB', 'RKA', 'RKAB', 'SKAI', 'DC', 'DRC', 'EOD', 'ATM',
       'BI', 'MIS', 'IT', 'RTGS/S4/ETP/SKNBI', 'ALMA', 'ATK'}
SMALL = {'DAN', 'DI', 'KE', 'DARI', 'ATAU'}


def tc(s):
    s = s.replace('SERCVICE', 'SERVICE').replace('KONDUMTIF', 'KONSUMTIF').replace('REKRUITMEN', 'REKRUTMEN')
    s = re.sub(r'\s+', ' ', s).strip()
    out = []
    for i, w in enumerate(s.split(' ')):
        bare = w.strip(',&()')
        if bare in ACR or w == '&':
            out.append(w)
        elif bare in SMALL and i:
            out.append(w.lower())
        else:
            out.append(w.capitalize() if '/' not in w else '/'.join(p.capitalize() for p in w.split('/')))
    return ' '.join(out)


PAGES = {
    # page: (unit name, jenis, direktorat)
    'corsec': ('Divisi Corporate Secretary', 'divisi', 'Direktur Utama'),
    'prc': ('Divisi Perencanaan', 'divisi', 'Direktur Utama'),
    'skai': ('Satuan Kerja Audit Internal', 'divisi', 'Direktur Utama'),
    'hukum': ('Bagian Hukum & Litigasi', 'bagian', 'Direktur Utama'),
    'kep': ('Divisi Kepatuhan, APU PPT & Strategi Anti Fraud', 'divisi', 'Direktur Kepatuhan'),
    'mrk': ('Divisi Manajemen Risiko', 'divisi', 'Direktur Kepatuhan'),
    'keu': ('Divisi Keuangan & Akuntansi', 'divisi', 'Direktur Umum'),
    'sdm': ('Divisi Sumber Daya Manusia', 'divisi', 'Direktur Umum'),
    'umum': ('Divisi Umum', 'divisi', 'Direktur Umum'),
    'tsi': ('Divisi Teknologi Sistem Informasi', 'divisi', 'Direktur Umum'),
    'ops': ('Divisi Operasional & Layanan', 'divisi', 'Direktur Umum'),
    'trs': ('Divisi Treasury', 'divisi', 'Direktur Pemasaran'),
    'krd': ('Divisi Perkreditan', 'divisi', 'Direktur Pemasaran'),
    'sek kom': ('Sekretariat Dewan Komisaris', 'bagian', None),
    'cabut': ('Kantor Cabang Utama', 'kantor', None),
    'cabang': ('Kantor Cabang', 'kantor', None),
    'capem': ('Kantor Cabang Pembantu', 'kantor', None),
    'kf': ('Kantor Fungsional', 'kantor', None),
}
ORDER = ['corsec', 'prc', 'skai', 'hukum', 'kep', 'mrk', 'keu', 'sdm', 'umum', 'tsi', 'ops', 'trs', 'PDJ', 'krd',
         'sek kom', 'cabut', 'cabang', 'capem', 'kf']

# manual corrections after reviewing the chart (geometry/edges ambiguous)
OVERRIDE = {
    'tsi': {'KEPALA SEKSI CORE BANKING & MIS': 'KEPALA BAGIAN PENGEMBANGAN TSI',
            'KEPALA SEKSI QUALITY ASSURANCE IT': 'KEPALA BAGIAN PENGEMBANGAN TSI'},
    'trs': {'KEPALA SEKSI DEALER': 'KEPALA BAGIAN TREASURY', 'PELAKSANA PELAPORAN': 'KEPALA BAGIAN TREASURY'},
    'mrk': {'KEPALA SEKSI CYBER SECURITY & RISIKO IT': 'KEPALA BAGIAN RISIKO OPERASIONAL & RISIKO LAINNYA'},
    'krd': {'PELAKSANA PEMASARAN KREDIT NON MIKRO & KECIL': 'KEPALA SEKSI PEMASARAN KREDIT NON MIKRO, KECIL & KONSUMTIF'},
    'cabut': {'CUSTOMER SERCVICE': 'KEPALA SEKSI PELAYANAN & JASA', 'TELLER': 'HEAD TELLER'},
    'capem': {k: 'PEMIMPIN CABANG PEMBANTU' for k in
              ['ACCOUNT OFFICER DANA & JASA ELEKTRONIK', 'RELATIONSHIP OFFICER', 'SALES OFFICER PRODUKTIF',
               'SALES OFFICER KONSUMTIF']},
}
# credit staff placed in branches report to Divisi Perkreditan (dashed line on main chart)
BRANCH_CREDIT = {'ANALIS KREDIT': ('krd', 'KEPALA BAGIAN ANALIS KREDIT'),
                 'SUPPORTING KREDIT': ('krd', 'KEPALA BAGIAN SUPPORTING KREDIT')}

units, jabatan = [], []


def add_unit(kode, nama, jenis, parent, direktorat=None, catatan=None):
    units.append(dict(kode=kode, nama=nama, jenis=jenis, parent_kode=parent, direktorat=direktorat,
                      urutan=len(units) + 1, catatan=catatan))
    return kode


def add_jab(kode, nama, unit, jenjang, kelompok, atasan, nama_asli=None, catatan=None):
    jabatan.append(dict(kode=kode, nama=nama, unit_kode=unit, jenjang=jenjang, kelompok=kelompok,
                        atasan_kode=atasan, nama_asli=nama_asli, urutan=len(jabatan) + 1, catatan=catatan))
    return kode


# --- Direksi & Dewan Komisaris
add_unit('DEKOM', 'Dewan Komisaris', 'dewan', None)
add_unit('DIR', 'Direksi', 'direksi', None)
add_jab('DIR-UT', 'Direktur Utama', 'DIR', 0, 'Direksi', None)
for k, n in [('DIR-UM', 'Direktur Umum'), ('DIR-KP', 'Direktur Kepatuhan'), ('DIR-PM', 'Direktur Pemasaran')]:
    add_jab(k, n, 'DIR', 0, 'Direksi', 'DIR-UT')
DIRJAB = {'Direktur Utama': 'DIR-UT', 'Direktur Umum': 'DIR-UM', 'Direktur Kepatuhan': 'DIR-KP',
          'Direktur Pemasaran': 'DIR-PM', None: None}


def kelompok(label, rank):
    L = label.upper()
    if L.startswith('PEMIMPIN'):
        return 'Pemimpin Kantor'
    if L.startswith(('KEPALA DIVISI', 'KEPALA SATUAN')):
        return 'Kepala Divisi'
    if L.startswith('KEPALA BAGIAN'):
        return 'Kepala Bagian'
    if L.startswith('KETUA KELOMPOK'):
        return 'Ketua Kelompok'
    if L.startswith('KEPALA SEKSI'):
        return 'Kepala Seksi'
    if L.startswith(('KOORDINATOR', 'HEAD TELLER')):
        return 'Koordinator'
    if L.startswith('PELAKSANA'):
        return 'Pelaksana'
    return 'Pelaksana' if rank == 4 else 'Lainnya'


label2code = {}   # (page,label) -> jabatan kode
pending_branch = []

for pi, page in enumerate(ORDER, 1):
    if page == 'PDJ':
        # Divisi Pemasaran Dana & Jasa has no detail page in the PDF; taken from the main chart
        u = add_unit('U13', 'Divisi Pemasaran Dana & Jasa', 'divisi', 'DIR', 'Direktur Pemasaran',
                     'Halaman detail tidak tersedia di dokumen struktur organisasi; hanya dari bagan utama.')
        kd = add_jab('U13-J01', 'Kepala Divisi Pemasaran Dana & Jasa', u, 1, 'Kepala Divisi', 'DIR-PM')
        for i, b in enumerate(['Pemasaran Dana', 'Pemasaran Jasa Elektronik'], 1):
            ub = add_unit(f'U13-B{i}', f'Bagian {b}', 'bagian', u)
            add_jab(f'U13-J{i + 1:02d}', f'Kepala Bagian {b}', ub, 2, 'Kepala Bagian', kd)
        continue
    uname, jenis, direktorat = PAGES[page]
    ukode = f'U{pi:02d}'
    parent_unit = 'DEKOM' if page == 'sek kom' else 'DIR'
    add_unit(ukode, uname, jenis, parent_unit, direktorat)
    ns = [n for n in raw[page] if n['label'] != 'DIVISI PERKREDITAN']
    byid = {n['id']: n for n in ns}
    lab2node = {n['label']: n for n in ns}
    ov = OVERRIDE.get(page, {})
    for n in ns:
        if n['label'] in ov:
            n['parent'] = lab2node[ov[n['label']]]['id']
    # order: by rank then x
    ns.sort(key=lambda n: (n['rank'], n['cx']))
    sub_units = {}   # jabatan id -> unit kode for bagian/seksi heads
    jcount = 0
    for n in ns:
        L = n['label']
        grp = kelompok(L, n['rank'])
        # determine unit of this jabatan
        parent = byid.get(n['parent']) if n.get('parent') else None
        if grp in ('Kepala Bagian', 'Kepala Seksi', 'Ketua Kelompok') and jenis != 'bagian':
            nm = re.sub(r'^(KEPALA BAGIAN|KEPALA SEKSI|KETUA KELOMPOK)\s*', '', L)
            prefix = {'Kepala Bagian': 'Bagian', 'Kepala Seksi': 'Seksi', 'Ketua Kelompok': 'Kelompok'}[grp]
            punit = sub_units.get(parent['id'], ukode) if parent else ukode
            uk = f'{ukode}-{len([x for x in units if x["parent_kode"] and x["kode"].startswith(ukode + "-")]) + 1:02d}'
            add_unit(uk, f'{prefix} {tc(nm)}', prefix.lower(), punit)
            sub_units[n['id']] = uk
            my_unit = uk
        elif n['label'] in BRANCH_CREDIT and jenis == 'kantor':
            my_unit = ukode
        elif parent is not None:
            my_unit = sub_units.get(parent['id'], parent.get('unit', ukode))
        else:
            my_unit = ukode
        jcount += 1
        jk = f'{ukode}-J{jcount:02d}'
        nama = tc(L)
        if grp == 'Kepala Divisi' and jenis == 'divisi' and not nama.startswith('Kepala Satuan'):
            nama = 'Kepala ' + uname
        if L == 'KEPALA SATUAN KERJA AUDIT INTERNAL':
            nama = 'Kepala Satuan Kerja Audit Internal'
        label2code[(page, L)] = jk
        n['jk'] = jk
        n['unit'] = my_unit
        n['nama'] = nama
        n['grp'] = grp
    for n in ns:
        if n['label'] in BRANCH_CREDIT and page in ('cabut', 'cabang', 'capem'):
            pending_branch.append(n)
            atasan = None
        elif n.get('parent') and n['parent'] in byid:
            atasan = byid[n['parent']]['jk']
        else:
            atasan = DIRJAB.get(direktorat) if n['rank'] <= 2 else None
        if page == 'sek kom' or (jenis == 'kantor' and n['grp'] == 'Pemimpin Kantor'):
            atasan = None

        cat = None
        if jenis == 'kantor' and n['grp'] == 'Pemimpin Kantor':
            cat = 'Garis pelaporan kantor ke Direksi tidak dirinci pada dokumen struktur organisasi.'
        if n['label'] in BRANCH_CREDIT and page in ('cabut', 'cabang', 'capem'):
            cat = 'Ditempatkan di kantor cabang; garis komando ke Divisi Perkreditan.'
        jenjang = {'Pemimpin Kantor': 1, 'Kepala Divisi': 1, 'Kepala Bagian': 2, 'Ketua Kelompok': 2,
                   'Kepala Seksi': 3, 'Koordinator': 3}.get(n['grp'], 4)
        add_jab(n['jk'], n['nama'], n['unit'], jenjang, n['grp'], atasan,
                nama_asli=n['label'], catatan=cat)
        n['_rec'] = jabatan[-1]

for n in pending_branch:
    pg, lab = BRANCH_CREDIT[n['label']]
    n['_rec']['atasan_kode'] = label2code[(pg, lab)]

# sanity
codes = {j['kode'] for j in jabatan}
for j in jabatan:
    assert j['atasan_kode'] is None or j['atasan_kode'] in codes, j
ucodes = {u['kode'] for u in units}
for u in units:
    assert u['parent_kode'] is None or u['parent_kode'] in ucodes, u

json.dump(dict(unit_kerja=units, jabatan=jabatan), open(OUT, 'w'), ensure_ascii=False, indent=1)
print(len(units), 'unit;', len(jabatan), 'jabatan')

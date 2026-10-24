"""Parse kamus kompetensi docx files into normalized JSON.

Usage: python -I parse_final.py <sumber-data dir> <out.json>
"""
import docx, sys, glob, re, json, collections, os
from docx.table import Table
from docx.text.paragraph import Paragraph

SRC, OUT = sys.argv[1], sys.argv[2]

TITLE = re.compile(
    r'^(?:Kode\s*&\s*Nama\s*Kompetensi\s*:\s*)?\(?\s*([A-Z]{2,4})\s*[-–]\s*(\d{1,2})\s*([A-Z])?\s*\)?\s*[:.]?\s*(.+)$')
LEVEL_HDR = re.compile(r'^(?:L|Level)\s*([1-5])\s*[-–—:]\s*(Dasar|Memadai|Mandiri|Mahir|Master)\b\s*(.*)$', re.I)
LEVEL_NAMES = {1: 'Dasar', 2: 'Memadai', 3: 'Mandiri', 4: 'Mahir', 5: 'Master'}

BIDANG = {
    'CC': ('Kompetensi Inti (Core Competencies)', 'inti'),
    'LC': ('Kompetensi Kepemimpinan (Leadership Competencies)', 'kepemimpinan'),
    'IAD': ('Audit Internal', 'teknis'),
    'CGA': ('Corporate & General Affairs', 'teknis'),
    'SPB': ('Corporate Strategic Planning & Business Development', 'teknis'),
    'CSM': ('Credit & Special Asset Management', 'teknis'),
    'DBM': ('Digital Banking', 'teknis'),
    'FNM': ('Finance Management', 'teknis'),
    'FTM': ('Funding & Treasury Management', 'teknis'),
    'HCM': ('Human Capital Management', 'teknis'),
    'ITD': ('Information Technology & Digital Security', 'teknis'),
    'MPS': ('Marketing, Product, and Solution Management', 'teknis'),
    'RMG': ('Risk Management', 'teknis'),
    'SBT': ('Service & Banking Transaction Operations', 'teknis'),
    'GCL': ('Governance, Compliance & Legal', 'teknis'),
}
# prefix typos found in documents -> canonical prefix
PREFIX_FIX = {'SBP': 'SPB', 'CSP': 'SPB'}


def norm(s):
    return re.sub(r'\s+', ' ', (s or '').replace('\xa0', ' ')).strip()


def split_note(title):
    """'Nama (C)> level 1 >> Umum' -> (nama, tanda_c, catatan)"""
    t = norm(title)
    tanda_c = bool(re.search(r'\(C\)', t))
    parts = re.split(r'\s*>+\s*', t, maxsplit=1)
    nama = parts[0]
    note = parts[1] if len(parts) > 1 else ''
    m = re.search(r'\(C\)\s*(.*)$', nama)
    if m:
        extra = m.group(1).strip()
        nama = nama[:m.start()].strip()
        if extra:
            note = (extra + (' | ' + note if note else '')).strip()
    nama = nama.rstrip('. ').strip()
    note = re.sub(r'^[>\s]+', '', note).strip()
    return nama, tanda_c, note or None


def cells(row):
    out, prev = [], None
    for c in row.cells:
        if c._tc is prev:
            continue
        prev = c._tc
        out.append(c)
    return out


def lines(c):
    return [norm(l) for l in c.text.split('\n') if norm(l)]


def clean_indicator(x):
    x = re.sub(r'^Indikator Perilaku\s*:?\s*', '', x)
    x = re.sub(r'^[•\-•●▪]+\s*', '', x)
    x = re.sub(r'^\d+[.)]\s+', '', x)
    return x.strip()


def parse_table(t):
    levels = []
    for r in t.rows:
        cs = cells(r)
        if len(cs) < 2:
            continue
        a, b = lines(cs[0]), lines(cs[1])
        if not a:
            continue
        m = LEVEL_HDR.match(a[0])
        if not m:
            continue
        lv = int(m.group(1))
        desc = ([m.group(3)] if m.group(3) else []) + a[1:]
        desc = re.sub(r'^Deskripsi\s*:\s*', '', ' '.join(desc)).strip()
        inds = [clean_indicator(x) for x in b]
        inds = [x for x in inds if x]
        levels.append(dict(level=lv, nama_level=LEVEL_NAMES[lv], deskripsi=desc, indikator=inds))
    return levels


def parse_para_levels(paras):
    """Levels written as paragraphs: 'L1 - Dasar' / 'Deskripsi: ...' / 'Indikator Perilaku:' / lines."""
    levels, cur, mode, rest = [], None, None, []
    for tx in paras:
        m = LEVEL_HDR.match(tx)
        if m:
            cur = dict(level=int(m.group(1)), nama_level=LEVEL_NAMES[int(m.group(1))], deskripsi='', indikator=[])
            levels.append(cur)
            mode = 'desc'
            continue
        if cur is None:
            rest.append(tx)
            continue
        if re.match(r'^Deskripsi\s*:', tx):
            mode = 'desc'
            tx = re.sub(r'^Deskripsi\s*:\s*', '', tx)
            if tx:
                cur['deskripsi'] = norm(cur['deskripsi'] + ' ' + tx)
            continue
        if re.match(r'^Indikator Perilaku\s*:?', tx):
            mode = 'ind'
            tx = re.sub(r'^Indikator Perilaku\s*:?\s*', '', tx)
            if tx:
                cur['indikator'].append(clean_indicator(tx))
            continue
        if mode == 'desc':
            cur['deskripsi'] = norm(cur['deskripsi'] + ' ' + tx)
        else:
            if re.match(r'^Tambahan Kompetensi', tx):
                rest.append(tx)
                cur = None
                continue
            cur['indikator'].append(clean_indicator(tx))
    return levels, rest


def iter_blocks(d, parent=None):
    for el in (parent if parent is not None else d.element.body).iterchildren():
        if el.tag.endswith('}sdt'):
            # content controls wrap regular paragraphs/tables
            for sc in el.iterchildren():
                if sc.tag.endswith('}sdtContent'):
                    yield from iter_blocks(d, sc)
        elif el.tag.endswith('}p'):
            tx = norm(Paragraph(el, d).text)
            if tx:
                yield 'p', tx
        elif el.tag.endswith('}tbl'):
            yield 't', Table(el, d)


def file_prefix(fn):
    m = re.search(r'\((IAD|CGA|SPB|CSM|DBM|FNM|FTM|HCM|ITD|MPS|RMG|SBT|GCL)[)\-]', fn)
    if m:
        return m.group(1)
    for k, kw in [('SPB', 'Strategic'), ('CSM', 'Credit'), ('DBM', 'Digital Banking'), ('FNM', 'Finance'),
                  ('FTM', 'Funding'), ('HCM', 'HCM'), ('ITD', 'Information Technology'), ('MPS', 'Marketing'),
                  ('RMG', 'Risk'), ('SBT', 'Service'), ('GCL', 'Governance'), ('CGA', 'Corporate & General'),
                  ('IAD', 'Audit'), ('CC', 'Core & Leadership')]:
        if kw in fn:
            return k
    raise ValueError(fn)


kompetensi = []     # canonical records
daftar_isi = []     # TOC entries per file
referensi = []      # cross-bidang references (kode, bidang_terkait, catatan)
issues = []


def make_code(prefix, num, suffix=''):
    return f"{prefix}-{int(num):02d}{suffix or ''}"


for path in sorted(glob.glob(os.path.join(SRC, '*.docx'))):
    fn = os.path.basename(path)
    fpre = file_prefix(fn)
    d = docx.Document(path)
    blocks = list(iter_blocks(d))

    # --- group blocks into sections starting at each title-like paragraph
    sections, cur, pre = [], None, []
    merged_next = False
    for kind, val in blocks:
        if kind == 'p':
            if re.match(r'^Opsi Merged', val, re.I):
                merged_next = True
                cur = None
                continue
            if merged_next and re.match(r'^Nama Kompetensi\s*:', val):
                cur = dict(raw=val, prefix=fpre, num=None, suffix='M',
                           title=re.sub(r'^Nama Kompetensi\s*:\s*', '', val), body=[], merged=True)
                sections.append(cur)
                merged_next = False
                continue
            if merged_next and re.match(r'^[A-Z]{2,4}-\d+$', val):
                continue
            m = TITLE.match(val)
            if m and not re.match(r'^Definisi', val, re.I):
                cur = dict(raw=val, prefix=m.group(1), num=m.group(2), suffix=m.group(3) or '',
                           title=m.group(4), body=[], merged=False)
                sections.append(cur)
                continue
        if cur is not None:
            cur['body'].append((kind, val))
        else:
            pre.append((kind, val))

    seq = 0
    for s in sections:
        body = s['body']
        has_def = any(k == 'p' and re.match(r'^(>>\s*)?Definisi\s*:', v, re.I) for k, v in body)
        has_tbl = any(k == 't' for k in body)
        has_plv = any(k == 'p' and LEVEL_HDR.match(v) for k, v in body)
        nama, tanda_c, note = split_note(s['title'])
        prefix = PREFIX_FIX.get(s['prefix'], s['prefix'])
        kode_dok = f"{s['prefix']}-{s['num']}{(' ' + s['suffix']) if s['suffix'] and not s['merged'] else ''}" if s['num'] else None

        if not (has_def or has_tbl or has_plv):
            # table-of-contents line (or annotation-only entry)
            if s['num']:
                notes = [n for n in [note] + [re.sub(r'^>>\s*', '', v) for k, v in body
                                               if k == 'p' and v.startswith('>>')] if n]
                daftar_isi.append(dict(file=fn, kode=make_code(prefix, s['num'], s['suffix']), nama=nama,
                                       tanda_c=tanda_c, catatan=' | '.join(notes) or None, kode_dokumen=kode_dok))
                if prefix != fpre and fpre != 'CC' and notes:
                    referensi.append(dict(kode=make_code(prefix, s['num'], s['suffix']), bidang_prefix=fpre,
                                          catatan=' | '.join(notes), punya_level=False))
            continue

        seq += 1
        definisi, defs_alt, levels, catatan = None, [], [], []
        if note:
            catatan.append(note)
        para_buf = []
        for k, v in body:
            if k == 't':
                levels += parse_table(v)
            elif re.match(r'^Definisi\s*:', v, re.I):
                if definisi is None:
                    definisi = re.sub(r'^Definisi\s*:\s*', '', v, flags=re.I)
                else:
                    defs_alt.append(re.sub(r'^Definisi\s*:\s*', '', v, flags=re.I))
            elif v.startswith('>>'):
                catatan.append(re.sub(r'^>>\s*', '', v))
            else:
                para_buf.append(v)
        if para_buf:
            plv, rest = parse_para_levels(para_buf)
            levels += plv
            for r in rest:
                if r.startswith('Catatan'):
                    catatan.append(r)
                elif re.match(r'^(KAMUS KOMPETENSI|Tambahan Kompetensi)', r):
                    continue
                else:
                    catatan.append(r)
        for a in defs_alt:
            catatan.append('Definisi alternatif: ' + a)

        rec = dict(kode=None, prefix=prefix, nama=nama, definisi=definisi, levels=levels,
                   catatan=catatan, tanda_c=tanda_c, file=fn, kode_dokumen=kode_dok,
                   urutan=seq, merged=s['merged'], num=s['num'], suffix=s['suffix'])

        # cross-bidang entry inside another bidang's file (e.g. ITD-22 inside Risk Management)
        if prefix != fpre and not (fpre == 'CC' and prefix in ('CC', 'LC')):
            rec['ref_from'] = fpre
        kompetensi.append(rec)

# ---------------- code assignment & cleaning ----------------
by_file = collections.defaultdict(list)
for r in kompetensi:
    by_file[r['file']].append(r)

final = []
for fn, recs in by_file.items():
    fpre = file_prefix(fn)
    own = [r for r in recs if 'ref_from' not in r]
    if fpre == 'IAD':
        # body numbering has a duplicate (IAD-04 twice); compilation xlsx numbers them 01..25 in order
        for i, r in enumerate(own, 1):
            r['kode'] = make_code('IAD', i)
            if r['kode_dokumen'] and r['kode_dokumen'] != r['kode']:
                r['catatan'].append(f"Kode di dokumen tertulis {r['kode_dokumen']}; dinomori ulang sesuai urutan & file kompilasi.")
    else:
        for r in own:
            if r['merged']:
                r['kode'] = f"{r['prefix']}-M01"
                r['catatan'].append('Opsi penggabungan (merged) FNM-01 s/d FNM-05 — usulan, belum final.')
            else:
                r['kode'] = make_code(r['prefix'], r['num'], r['suffix'])
            if r['kode_dokumen'] and r['kode_dokumen'].split('-')[0] != r['prefix']:
                r['catatan'].append(f"Kode di dokumen tertulis {r['kode_dokumen']} (salah ketik prefix).")
    final += own

codes = {r['kode']: r for r in final}
for fn, recs in by_file.items():
    for r in recs:
        if 'ref_from' not in r:
            continue
        kode = make_code(r['prefix'], r['num'], r['suffix'])
        owner = codes.get(kode)
        referensi.append(dict(kode=kode, bidang_prefix=r['ref_from'], catatan='; '.join(r['catatan']) or None,
                              punya_level=len(r['levels']) == 5))
        if owner is None:
            issues.append(f'referensi {kode} di {fn} tidak ditemukan di bidang pemilik')
        elif len(owner['levels']) < 5 and len(r['levels']) == 5:
            owner['levels'] = r['levels']
            owner['catatan'].append(f'Level diambil dari salinan di file {fn}.')

# TOC-only entries that never got a body -> record as status
toc_by_code = {}
for t in daftar_isi:
    if t['kode'].split('-')[0] != file_prefix(t['file']) and t['kode'].split('-')[0] not in ('CC', 'LC'):
        continue
    toc_by_code.setdefault(t['kode'], t)

for r in final:
    t = toc_by_code.get(r['kode'])
    if t and r['prefix'] != 'IAD':
        if t['tanda_c']:
            r['tanda_c'] = True
        if t['catatan'] and t['catatan'] not in r['catatan']:
            r['catatan'].insert(0, t['catatan'])
        if r['nama'].isupper():
            r['nama'] = t['nama']
        r['nama_daftar_isi'] = t['nama'] if norm(t['nama']).lower() != norm(r['nama']).lower() else None

for k, t in toc_by_code.items():
    if k in codes or t['kode'].startswith('IAD'):
        continue
    status = 'dihapus' if t['catatan'] and 'take out' in t['catatan'].lower() else 'belum_disusun'
    final.append(dict(kode=k, prefix=k.split('-')[0], nama=t['nama'], definisi=None, levels=[],
                      catatan=[t['catatan']] if t['catatan'] else [], tanda_c=t['tanda_c'], file=t['file'],
                      kode_dokumen=t['kode_dokumen'], urutan=999, merged=False))

for r in final:
    lv = sorted(l['level'] for l in r['levels'])
    if r.get('status') is None:
        if r['merged']:
            r['status'] = 'usulan'
        elif any('take out' in c.lower() for c in r['catatan']):
            r['status'] = 'dihapus'
        elif r['definisi'] and lv == [1, 2, 3, 4, 5]:
            r['status'] = 'lengkap'
        elif r['definisi'] or lv:
            r['status'] = 'draft'
        else:
            r['status'] = 'belum_disusun'
    if lv and lv != [1, 2, 3, 4, 5]:
        issues.append(f"{r['kode']}: level tidak lengkap {lv}")
    for l in r['levels']:
        if not l['indikator']:
            issues.append(f"{r['kode']} L{l['level']}: tanpa indikator")

# duplicates check
cnt = collections.Counter(r['kode'] for r in final)
for k, v in cnt.items():
    if v > 1:
        issues.append(f'DUPLIKAT {k} x{v}')

for r in final:
    nd = r.get('nama_daftar_isi')
    if nd and r['nama'].isupper():
        r['nama'], r['nama_daftar_isi'] = nd, None
    if r['kode'] == 'RMG-21':
        # heading merged with ITD-22 title and a truncated definition in the source document
        r['catatan'].append(f"Judul di dokumen: \"{r['nama']}\"; definisi terpotong: \"{r['definisi']}\". "
                            "Tabel level belum ada — kemungkinan digantikan ITD-22.")
        r['nama'] = 'Melaksanakan Stress Testing dan Back Testing'
        r['definisi'] = None
        r['status'] = 'draft'
    r['catatan'] = [c for i, c in enumerate(r['catatan']) if c and c not in r['catatan'][:i]]
    # keep kode_dokumen only when the document used a different code
    if r['kode_dokumen'] and r['kode_dokumen'].replace(' ', '') == r['kode']:
        r['kode_dokumen'] = None
    for k in ('num', 'suffix', 'ref_from'):
        r.pop(k, None)

merged_ref = {}
for x in referensi:
    key = (x['kode'], x['bidang_prefix'])
    m = merged_ref.setdefault(key, dict(x))
    m['punya_level'] = m['punya_level'] or x['punya_level']
    notes = [n for n in [m['catatan'], x['catatan']] if n]
    m['catatan'] = ' | '.join(dict.fromkeys(notes)) or None
referensi = list(merged_ref.values())

final.sort(key=lambda r: (list(BIDANG).index(r['prefix']), r['kode']))
json.dump(dict(bidang=BIDANG, kompetensi=final, referensi=referensi, issues=issues),
          open(OUT, 'w'), ensure_ascii=False, indent=1)
print('kompetensi', len(final), collections.Counter(r['status'] for r in final))
print(collections.Counter(r['prefix'] for r in final))
print('referensi', referensi)
print('\n'.join(issues))

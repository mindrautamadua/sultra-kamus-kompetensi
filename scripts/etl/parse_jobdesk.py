"""Extract jobdesk (uraian tugas jabatan) from the Word documents in sumber-data/<folder>/.

Only Word files are read (.docx, plus legacy .doc converted to .docx with macOS `textutil`);
the PDF copies are ignored. Every document follows the same label/value layout
(Jabatan, Atasan Langsung, Membawahi, Syarat Jabatan, Fungsi, Tugas Pokok, ...), so tables
and paragraphs are flattened into one ordered list of lines and read with a small state machine.

Usage: python -I parse_jobdesk.py <sumber-data dir> <out.json>
"""
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

import docx
from docx.table import Table
from docx.text.paragraph import Paragraph

SRC, OUT = sys.argv[1], sys.argv[2]
CACHE = os.path.join(tempfile.gettempdir(), 'kamus-kompetensi-doc2docx')

SECTIONS = {
    'jabatan': 'jabatan', 'nama jabatan': 'jabatan',
    'atasan langsung': 'atasan',
    'membawahi': 'membawahi',
    'syarat jabatan': 'syarat',
    'fungsi': 'fungsi',
    'tugas pokok': 'tugas',
    'kewenangan': 'Kewenangan',
    'tugas kolektif': 'Tugas Kolektif',
    'jabatan ex officio': 'Jabatan Ex Officio',
    'kewajiban pelaporan': 'Kewajiban Pelaporan',
}
SYARAT = {
    'pendidikan': 'pendidikan', 'pendidikan tambahan': 'pendidikan_tambahan',
    'pangkat': 'pangkat', 'pangkat/golongan': 'pangkat', 'grade minimal': 'pangkat', 'grade': 'pangkat',
    'pendidikan pokok': 'pendidikan', 'minimal grade': 'pangkat',
    'pengalaman kerja': 'pengalaman_kerja', 'pengalaman': 'pengalaman_kerja',
    'kompetensi': 'kompetensi',
}
# baris kop/footer dokumen yang bukan isi jobdesk
NOISE = re.compile(r'^(Halaman\b|PAGE\b|No\. ?Dok|Revisi$|Tanggal$|Penyetuju$|:$|URAIAN TUGAS PEGAWAI$|'
                   r'Maju Bersama$|\d{2}/\d{2}/\d{4}$)', re.I)
MANAJEMEN = ('perencanaan', 'pengorganisasian', 'pengarahan', 'pengawasan')
# salah ketik di dokumen sumber; diperbaiki di setiap baris supaya nama jabatan, atasan & bawahan tetap cocok
TYPO = {'Reocvery': 'Recovery'}
TYPO_RE = re.compile(r'\b(' + '|'.join(map(re.escape, TYPO)) + r')\b')


def key(t):
    return re.sub(r'\s+', ' ', t).strip().rstrip(':').strip().lower()


def to_docx(path):
    if path.endswith('.docx'):
        return path
    os.makedirs(CACHE, exist_ok=True)
    out = os.path.join(CACHE, hashlib.md5(open(path, 'rb').read()).hexdigest() + '.docx')
    if not os.path.exists(out):
        subprocess.run(['textutil', '-convert', 'docx', '-output', out, path], check=True, capture_output=True)
    return out


def lines(path):
    d = docx.Document(to_docx(path))
    out = []

    def walk(parent, body):
        for el in body.iterchildren():
            tag = el.tag.split('}')[1]
            if tag == 'p':
                t = re.sub(r'\s+', ' ', Paragraph(el, parent).text).strip()
                t = TYPO_RE.sub(lambda m: TYPO[m.group(1)], t)
                if t:
                    out.append(t)
            elif tag == 'tbl':
                for r in Table(el, parent).rows:
                    seen = set()
                    for c in r.cells:  # sel gabungan (merged) muncul berulang — baca sekali
                        if id(c._tc) not in seen:
                            seen.add(id(c._tc))
                            walk(c, c._tc)
    walk(d, d.element.body)
    res = []
    for t in out:
        if not (res and res[-1] == t):
            res.append(t)
    return res


def parse(path):
    ls = lines(path)
    start = next((i for i, t in enumerate(ls) if SECTIONS.get(key(t)) == 'jabatan'), None)
    if start is None:
        return None
    r = dict(nama_jabatan=None, atasan_langsung=None, membawahi=[], pendidikan=None, pendidikan_tambahan=None,
             pangkat=None, pengalaman_kerja=None, kompetensi=None, fungsi=[], tugas=[], label_lain=[])
    sec, sub, kategori = None, None, None
    syarat = {}
    i = start
    while i < len(ls):
        t = ls[i]
        k = key(t)
        i += 1
        if NOISE.match(t):
            continue
        if t == 'Pembuat':
            # kop dokumen hasil konversi .doc ikut terbaca di akhir: "<JENJANG>", Pembuat, Penyetuju, ...
            while r['tugas'] and re.fullmatch(r'[^a-z]+', r['tugas'][-1]['deskripsi']):
                r['tugas'].pop()
            break
        if k in SECTIONS:
            sec, sub = SECTIONS[k], None
            kategori = sec if sec[0].isupper() else None
            continue
        if sec == 'syarat' and k in SYARAT:
            sub = SYARAT[k]
            continue
        # "A" / "B." lalu nama kategori (Perencanaan, Pengorganisasian, ...); beberapa dokumen tanpa label "Tugas Pokok"
        if re.fullmatch(r'[A-H]\.?', t) and i < len(ls) and (sec == 'tugas' or key(ls[i]) in MANAJEMEN):
            sec, kategori = 'tugas', ls[i].rstrip(':')
            if key(kategori) == 'tugas pokok':
                kategori = None
            i += 1
            continue
        if sec == 'tugas' and k in MANAJEMEN:
            kategori = t
            continue
        t = re.sub(r'^(\d{1,2}[.)]|[a-z][.)]|[-•●▪·])\s+', '', t)
        if sec == 'jabatan':
            # "Kepala Divisi X" lalu "Ex Officio ..." — jabatan ex officio ikut tertulis di sel nama jabatan
            nama, ex = (re.split(r'\s*\bEx[ -]?Officio\b\s*', t, maxsplit=1, flags=re.I) + [None])[:2]
            if nama:
                r['nama_jabatan'] = nama if not r['nama_jabatan'] else r['nama_jabatan'] + ' ' + nama
            if ex is not None:
                sec = kategori = 'Jabatan Ex Officio'
                t = ex
        if sec == 'Jabatan Ex Officio':
            r['tugas'] += [dict(kategori=sec, deskripsi=x) for x in re.split(r'(?<=\.)\s+(?=[A-Z])', t) if x]
        elif sec == 'jabatan':
            pass
        elif sec == 'atasan':
            r['atasan_langsung'] = t if not r['atasan_langsung'] else r['atasan_langsung'] + ' / ' + t
        elif sec == 'membawahi':
            r['membawahi'] += [x.strip() for x in t.split(' / ') if x.strip()]
        elif sec == 'syarat':
            if sub:
                syarat.setdefault(sub, []).append(t)
            else:
                r['label_lain'].append('syarat: ' + t)
        elif sec == 'fungsi':
            r['fungsi'].append(t)
        elif sec == 'tugas' or (sec and sec[0].isupper()):
            r['tugas'].append(dict(kategori=kategori, deskripsi=t))
    for k_, v in syarat.items():
        v = [x for x in v if x != '-']
        r[k_] = '\n'.join(v) or None
    return r


rows, skipped = [], []
files = sorted(f for f in glob.glob(os.path.join(SRC, '*', '*.doc*'))
               if f.endswith(('.doc', '.docx')) and not os.path.basename(f).startswith('~$'))
for f in files:
    folder, name = os.path.basename(os.path.dirname(f)), os.path.basename(f)
    if 'cover' in name.lower():
        continue
    r = parse(f)
    if not r or not r['nama_jabatan']:
        skipped.append(os.path.relpath(f, SRC))
        continue
    m = re.match(r'^(\d+(?:\.[0-9A-Z]+)*)\.?\s', name)
    r.update(folder=folder, kode_dokumen=m.group(1) if m else None, file=os.path.relpath(f, SRC))
    rows.append(r)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(dict(jobdesk=rows, dilewati=skipped), open(OUT, 'w'), ensure_ascii=False, indent=1)
print(f'jobdesk: {len(rows)} dokumen, {sum(len(r["tugas"]) for r in rows)} tugas, {len(skipped)} dilewati')

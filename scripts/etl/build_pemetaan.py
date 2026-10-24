"""Draft (usulan) mapping of kompetensi + level target per jabatan, for HC to review.

Rules:
- Bila supabase/data/pemetaan_ai.json memuat jabatan itu (dan jobdesk-nya belum berubah sejak dianalisis), kompetensi
  teknis, level, bukti (nomor butir tugas) dan alasannya diambil dari analisis AI; selain itu dipakai TF-IDF di bawah.
- Kompetensi Inti (CC) -> every jabatan (except Direksi, which has no jobdesk).
- Kompetensi Kepemimpinan (LC) -> jabatan struktural (jenjang 1-3).
- Kompetensi teknis -> candidates from the bidang relevant to the jabatan's unit induk (BIDANG_UNIT), ranked by
  TF-IDF cosine similarity between the jobdesk text (fungsi + tugas) and the kompetensi text (nama, definisi,
  level descriptions, indikator). Keep the top MIN..MAX whose score >= RELATIF x the best score.
- Level target by jenjang (LEVEL_JENJANG; Pemimpin Kantor by office type), capped by notes in the dictionary
  such as "sampai L-2" and by the highest level that has content.

Usage: python -I build_pemetaan.py <kompetensi.json> <struktur_organisasi.json> <jobdesk.json> <out.json> [pemetaan_ai.json]
"""
import collections
import json
import math
import os
import re
import sys

KOMP, ORG, JOB, OUT = sys.argv[1:5]
AI = sys.argv[5] if len(sys.argv) > 5 and os.path.exists(sys.argv[5]) else None
ai = json.load(open(AI))['jabatan'] if AI else {}
kamus = json.load(open(KOMP))['kompetensi']
org = json.load(open(ORG))
jobdesk = {r['file']: r for r in json.load(open(JOB))['jobdesk']}

BIDANG_UNIT = {
    'KCU': 'SBT CSM FTM MPS', 'KC': 'SBT CSM FTM MPS', 'KCP1': 'SBT CSM FTM MPS', 'KCP2': 'SBT CSM FTM MPS',
    'KCP3': 'SBT CSM FTM MPS', 'KF': 'SBT FTM MPS',
    'D04': 'SPB FNM', 'D05': 'CGA GCL', 'D06': 'GCL', 'D07': 'CSM RMG', 'D08': 'CSM MPS', 'D09': 'CSM MPS',
    'D10': 'GCL', 'D11': 'RMG ITD', 'D12': 'FTM MPS DBM', 'D13': 'ITD DBM', 'D14': 'HCM', 'D15': 'SBT DBM',
    'D16': 'FNM', 'D17': 'FTM', 'D18': 'CGA', 'D19': 'IAD', 'D20': 'ITD GCL',
}
LEVEL_JENJANG = {1: 5, 2: 4, 3: 3, 4: 2}
LEVEL_PEMIMPIN = {'KCU': 5, 'KC': 4, 'KCP1': 3, 'KCP2': 3, 'KCP3': 3, 'KF': 3}
MIN, MAX, RELATIF = 3, 6, 0.35
LEMAH = 0.03  # skor tertinggi di bawah ini = bukti kemiripan lemah, prioritaskan review

STOP = set('''dan atau yang di ke dari untuk dengan dalam pada serta oleh sesuai secara agar terhadap atas bank sultra
kemampuan mampu melakukan melaksanakan mengelola menyusun memastikan memberikan sebagai antara lain seluruh setiap
berlaku ketentuan unit kerja tugas lainnya baik tersebut adalah akan dapat telah bagi para berdasarkan termasuk the and
of hal masing bawahan atasan kepala bagian seksi divisi pelaksana membantu kegiatan pelaksanaan laporan menjadi
tanggung jawab tepat waktu benar'''.split())


def tokens(s):
    w = [x for x in re.findall(r'[a-z0-9]+', s.lower()) if len(x) > 2 and x not in STOP]
    return w + [a + '_' + b for a, b in zip(w, w[1:])]


def max_level(k):
    """Highest level with content, capped by notes like "sampai L-2"."""
    isi = [lv['level'] for lv in k['levels'] if lv['indikator'] or lv['deskripsi']]
    top = max(isi) if isi else 0
    for c in k['catatan']:
        m = re.search(r'sampai L-?(\d)', c, re.I)
        if m:
            top = min(top, int(m.group(1)))
    return top


aktif = [k for k in kamus if k['status'] == 'lengkap' and max_level(k)]
teknis = [k for k in aktif if k['prefix'] not in ('CC', 'LC')]
k_text = {k['kode']: collections.Counter(tokens(
    (k['nama'] + ' ') * 3 + (k['definisi'] or '') * 2 + ' '.join(lv['deskripsi'] or '' for lv in k['levels']) + ' ' +
    ' '.join(i for lv in k['levels'] for i in lv['indikator']))) for k in teknis}
jabatan = [j for j in org['jabatan'] if j['files']]
j_text = {}
for j in jabatan:
    d = jobdesk[j['files'][0]]
    j_text[j['kode']] = collections.Counter(tokens(' '.join(d['fungsi']) * 2 + ' ' +
                                                   ' '.join(t['deskripsi'] for t in d['tugas'])))

# idf atas gabungan korpus kamus + jobdesk, supaya kalimat baku jobdesk ("menyusun laporan ...") berbobot rendah
df = collections.Counter(w for c in list(k_text.values()) + list(j_text.values()) for w in c)
n_doc = len(k_text) + len(j_text)


def vec(c):
    v = {w: (1 + math.log(n)) * math.log(n_doc / (1 + df[w])) for w, n in c.items()}
    s = math.sqrt(sum(x * x for x in v.values())) or 1
    return {w: x / s for w, x in v.items()}


kv = {k: vec(c) for k, c in k_text.items()}
by_kode = {k['kode']: k for k in aktif}
rows, tanpa, dipakai_ai = [], [], 0
for j in jabatan:
    unit = j['unit_kode'].split('-')[0]
    lvl = LEVEL_PEMIMPIN[unit] if j['kelompok'] == 'Pemimpin Kantor' else LEVEL_JENJANG[j['jenjang']]

    def add(k, alasan, skor=None, metode='tfidf', level=None, bukti=()):
        rows.append(dict(jabatan_kode=j['kode'], kompetensi_kode=k['kode'], level_target=min(level or lvl, max_level(k)),
                         skor=skor, catatan=alasan, metode=metode, bukti=list(bukti)))

    for k in aktif:
        if k['prefix'] == 'CC':
            add(k, 'Kompetensi inti: berlaku untuk semua jabatan.', metode='aturan')
        elif k['prefix'] == 'LC' and j['jenjang'] <= 3:
            add(k, 'Kompetensi kepemimpinan: jabatan struktural.', metode='aturan')

    a = ai.get(j['kode'])
    doc = jobdesk[j['files'][0]]
    if a and a['file'] == j['files'][0] and a['jumlah_tugas'] == len(doc['tugas']):
        for c in a['kompetensi']:
            if c['kode'] in by_kode:
                add(by_kode[c['kode']], c['alasan'], metode='ai', level=c['level'], bukti=c['bukti'])
        tanpa.extend((j['files'][0], n) for n in a['tugas_tidak_tercakup'])
        dipakai_ai += 1
        continue
    jv = vec(j_text[j['kode']])
    bidang = BIDANG_UNIT[unit].split()
    skor = sorted(((sum(x * kv[k].get(w, 0) for w, x in jv.items()), k) for k in kv if k.split('-')[0] in bidang),
                  reverse=True)
    best = skor[0][0] if skor else 0
    for i, (s, k) in enumerate(skor[:MAX]):
        if i >= MIN and s < RELATIF * best:
            break
        lemah = 'Bukti lemah — prioritaskan review. ' if best < LEMAH else ''
        add(by_kode[k], f'{lemah}Kemiripan uraian tugas dengan kompetensi (peringkat {i + 1} dari bidang '
            f'{", ".join(bidang)}).', round(s, 4))

# butir tugas tanpa padanan kamus: (file jobdesk, nomor tugas), unik
tanpa = sorted(set(tanpa))
json.dump(dict(pemetaan=rows, tugas_tanpa_kompetensi=[dict(file=f, urutan=n) for f, n in tanpa]), open(OUT, 'w'),
          ensure_ascii=False, indent=1)
n_tek = sum(1 for r in rows if r['metode'] in ('tfidf', 'ai'))
print(f'pemetaan usulan: {len(rows)} baris untuk {len(jabatan)} jabatan ({n_tek} teknis; {dipakai_ai} jabatan dari analisis AI,'
      f' {len(jabatan) - dipakai_ai} TF-IDF); {len(tanpa)} butir tugas tanpa padanan kamus')

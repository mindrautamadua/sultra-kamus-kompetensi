import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type ISectionOptions,
} from "docx";
import type { JobdeskDoc, Tugas } from "@/lib/dokumen/data";
import { labelJabatan, TANGGAL_DOKUMEN } from "@/lib/dokumen/jobdesk-pdf";

// Uraian jabatan dalam format Word (.docx), tata letak sama dengan jobdesk-pdf.tsx:
// satu section per jabatan agar kepala dokumen & nomor halaman berulang per jabatan.

const LOGO = fs.readFileSync(path.join(process.cwd(), "public/brand/logo-bank-sultra.png"));

// A4, satuan DXA (1440 = 1 inci)
const LEBAR = 9638; // 11906 - 2 x 1134
const PAGE = { size: { width: 11906, height: 16838 }, margin: { top: 2600, bottom: 1500, left: 1134, right: 1134, header: 600, footer: 600 } };
const UKURAN = 19; // setengah poin: 9,5 pt
const garis = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const BINGKAI = { top: garis, bottom: garis, left: garis, right: garis };
const MARGIN_SEL = { top: 40, bottom: 40, left: 80, right: 80 };

const teks = (t: string, o: Partial<{ bold: boolean; size: number; color: string }> = {}) => new TextRun({ text: t, size: UKURAN, ...o });

function par(isi: string | TextRun, alignment?: (typeof AlignmentType)[keyof typeof AlignmentType], after = 0) {
  return new Paragraph({ children: [typeof isi === "string" ? teks(isi) : isi], alignment, spacing: { after, line: 264 } });
}

function sel(
  children: (Paragraph | Table)[],
  width: number,
  o: Partial<{ columnSpan: number; rowSpan: number; shading: { type: typeof ShadingType.CLEAR; fill: string; color: string }; verticalAlign: typeof VerticalAlign.CENTER }> = {},
) {
  return new TableCell({ children, width: { size: width, type: WidthType.DXA }, borders: BINGKAI, margins: MARGIN_SEL, ...o });
}

/** Butir bernomor: nomor ditulis sebagai teks (seperti dokumen sumber), baris berikutnya menggantung. */
function butir(nomor: number, t: string) {
  return new Paragraph({
    children: [teks(`${nomor}.`), teks("\t"), teks(t)],
    tabStops: [{ type: TabStopType.LEFT, position: 400 }],
    indent: { left: 400, hanging: 400 },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 50, line: 264 },
  });
}

function kepala(d: JobdeskDoc) {
  const W = [2506, 4241, 2891];
  const judul = (t: string, size: number) => new Paragraph({ alignment: AlignmentType.CENTER, children: [teks(t, { bold: true, size })] });
  const pemisah = () => new Paragraph({ border: { bottom: garis }, spacing: { after: 60 }, children: [] });
  const meta: [string, TextRun[]][] = [
    ["No. Dok.", [teks(d.kodeDokumen, { size: 15 })]],
    ["Halaman", [new TextRun({ children: [PageNumber.CURRENT], size: 15 })]],
    ["Revisi", []],
    ["Tanggal", [teks(TANGGAL_DOKUMEN, { size: 15 })]],
    ["Pembuat", []],
    ["Penyetuju", []],
  ];
  return new Table({
    width: { size: LEBAR, type: WidthType.DXA },
    columnWidths: W,
    rows: [
      new TableRow({
        children: [
          sel(
            [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: LOGO, transformation: { width: 140, height: 35 } })] })],
            W[0],
            { verticalAlign: VerticalAlign.CENTER },
          ),
          sel(
            [
              judul("URAIAN TUGAS PEGAWAI", 26),
              pemisah(),
              judul("PT. BANK PEMBANGUNAN DAERAH", 17),
              judul("SULAWESI TENGGARA", 17),
              pemisah(),
              judul(labelJabatan(d), 20),
            ],
            W[1],
            { verticalAlign: VerticalAlign.CENTER },
          ),
          sel(
            meta.map(
              ([k, v]) =>
                new Paragraph({
                  spacing: { after: 20 },
                  tabStops: [
                    { type: TabStopType.LEFT, position: 850 },
                    { type: TabStopType.LEFT, position: 1000 },
                  ],
                  children: [teks(k, { bold: true, size: 15 }), teks("\t:\t", { size: 15 }), ...v],
                }),
            ),
            W[2],
            { verticalAlign: VerticalAlign.CENTER },
          ),
        ],
      }),
    ],
  });
}

// Badan: tabel 3 kolom; baris biasa = label + isi (gabungan 2 kolom), Syarat Jabatan memakai kolom tengah.
const K = [2350, 2000, LEBAR - 4350];

const barisLabel = (label: string, isi: Paragraph[]) =>
  new TableRow({ children: [sel([par(teks(label, { bold: true }))], K[0]), sel(isi, K[1] + K[2], { columnSpan: 2 })] });

function syaratJabatan(d: JobdeskDoc) {
  const syarat = (
    [
      ["Pendidikan", d.pendidikan],
      ["Pendidikan Tambahan", d.pendidikanTambahan],
      ["Pangkat", d.pangkat],
      ["Pengalaman Kerja", d.pengalaman],
      ["Kompetensi", d.kompetensi],
    ] as [string, string | null][]
  ).filter((x): x is [string, string] => !!x[1]);
  if (!syarat.length) return [barisLabel("Syarat Jabatan", [par("-")])];
  const bernomor = syarat.length > 1;
  return syarat.map(([k, v], i) => {
    const kanan = [sel([par(bernomor ? `${i + 1}.  ${k}` : k)], K[1]), sel([par(v, AlignmentType.JUSTIFIED)], K[2])];
    const kiri = i === 0 ? [sel([par(teks("Syarat Jabatan", { bold: true }))], K[0], { rowSpan: syarat.length })] : [];
    return new TableRow({ cantSplit: true, children: [...kiri, ...kanan] });
  });
}

/** Kelompokkan tugas berurutan dengan kategori yang sama (Perencanaan, Pengorganisasian, ...). */
function kelompokTugas(tugas: Tugas[]) {
  const out: { kategori: string | null; items: string[]; mulai: number }[] = [];
  tugas.forEach((t, i) => {
    const akhir = out.at(-1);
    if (akhir && akhir.kategori === t.kategori) akhir.items.push(t.deskripsi);
    else out.push({ kategori: t.kategori, items: [t.deskripsi], mulai: i + 1 });
  });
  return out;
}

function tugasPokok(tugas: Tugas[]) {
  if (!tugas.length) return [barisLabel("Tugas Pokok", [par("-")])];
  const kelompok = kelompokTugas(tugas);
  if (kelompok.every((k) => !k.kategori)) return [barisLabel("Tugas Pokok", kelompok[0].items.map((t, i) => butir(i + 1, t)))];
  return [
    new TableRow({
      cantSplit: true,
      children: [
        sel([par(teks("Tugas Pokok", { bold: true }), AlignmentType.CENTER)], LEBAR, {
          columnSpan: 3,
          shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" },
        }),
      ],
    }),
    ...kelompok.map((k, i) =>
      barisLabel(
        k.kategori ? `${String.fromCharCode(65 + i)}.  ${k.kategori}` : "Tugas Pokok",
        k.items.map((t, j) => butir(k.mulai + j, t)),
      ),
    ),
  ];
}

function badan(d: JobdeskDoc) {
  const rows = [barisLabel("Jabatan", [par(teks(d.nama, { bold: true }))]), barisLabel("Atasan Langsung", [par(d.atasan ?? "-")])];
  if (d.membawahi.length) rows.push(barisLabel("Membawahi", d.membawahi.map((m, i) => butir(i + 1, m))));
  rows.push(...syaratJabatan(d));
  rows.push(barisLabel("Fungsi", d.fungsi.length ? d.fungsi.map((f) => par(f, AlignmentType.JUSTIFIED, 60)) : [par("-")]));
  rows.push(...tugasPokok(d.tugas));
  return new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: K, rows });
}

const kaki = () =>
  new Footer({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, border: BINGKAI, children: [teks("Maju Bersama", { bold: true, size: 28 })] })],
  });

/** Halaman sampul berisi daftar jabatan yang dimuat. */
function sampul(docs: JobdeskDoc[], judul: string): ISectionOptions {
  const W = [700, 2000, 4138, 2800];
  const kepalaKolom = (t: string, w: number) =>
    sel([par(teks(t, { bold: true, color: "FFFFFF" }), AlignmentType.CENTER)], w, {
      shading: { type: ShadingType.CLEAR, fill: "1F3864", color: "auto" },
      verticalAlign: VerticalAlign.CENTER,
    });
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [kepalaKolom("No", W[0]), kepalaKolom("No. Dok.", W[1]), kepalaKolom("Jabatan", W[2]), kepalaKolom("Unit Kerja", W[3])],
    }),
    ...docs.map(
      (d, i) =>
        new TableRow({
          cantSplit: true,
          children: [
            sel([par(String(i + 1), AlignmentType.CENTER)], W[0]),
            sel([par(d.kodeDokumen)], W[1]),
            sel([par(d.nama)], W[2]),
            sel([par(d.unit ?? "-")], W[3]),
          ],
        }),
    ),
  ];
  return {
    properties: { page: { ...PAGE, margin: { ...PAGE.margin, top: 1134 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: LOGO, transformation: { width: 240, height: 61 } })] }),
      new Paragraph({ spacing: { before: 300 }, alignment: AlignmentType.CENTER, children: [teks(judul.toUpperCase(), { bold: true, size: 36 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [teks("PT. BANK PEMBANGUNAN DAERAH SULAWESI TENGGARA", { bold: true, size: 24 })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [teks(`Struktur Organisasi 2026 (Perubahan Ketiga) · ${docs.length} jabatan`, { size: 20 })],
      }),
      new Paragraph({ spacing: { after: 120 }, children: [teks("Daftar Jabatan", { bold: true, size: 24 })] }),
      new Table({ width: { size: LEBAR, type: WidthType.DXA }, columnWidths: W, rows }),
    ],
  };
}

export function renderUraianDocx(docs: JobdeskDoc[], judul: string) {
  const doc = new Document({
    creator: "PT. Bank Pembangunan Daerah Sulawesi Tenggara",
    title: judul,
    styles: { default: { document: { run: { font: "Arial", size: UKURAN } } } },
    sections: [
      sampul(docs, judul),
      ...docs.map(
        (d): ISectionOptions => ({
          properties: { page: { ...PAGE, pageNumbers: { start: 1 } } },
          headers: { default: new Header({ children: [kepala(d), new Paragraph({ children: [] })] }) },
          footers: { default: kaki() },
          children: [badan(d)],
        }),
      ),
    ],
  });
  return Packer.toBuffer(doc);
}

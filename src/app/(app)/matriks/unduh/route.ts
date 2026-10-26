import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { JENJANG_LABEL, KATEGORI_LABEL, LEVEL_NAMA } from "@/lib/labels";
import { loadMatriks } from "@/lib/matriks";
import { bacaPengaturan } from "@/lib/pengaturan";

// Matriks kompetensi sebagai file Excel (.xlsx) dengan tiga sheet:
// - Matriks: jabatan x kompetensi, sel berwarna sesuai level (sama dengan .lv1–.lv5 di globals.css);
// - Data: satu baris per pasangan jabatan–kompetensi, siap untuk PivotTable / filter;
// - Kompetensi: daftar kolom beserta jumlah jabatan yang memakainya.

const LEVEL_WARNA = ["FFEEF3FF", "FFDBE5FE", "FF93B0FB", "FF2747D9", "FF1D2D73"];
const LEVEL_TEKS = ["FF1E3192", "FF1D2D73", "FF121A42", "FFFFFFFF", "FFFFFFFF"];
const KATEGORI_WARNA: Record<string, string> = { inti: "FF1F37B4", kepemimpinan: "FFFBBF24", teknis: "FF38BDF8" };
const NAVY = "FF121A42";
const ABU = "FFF1F5F9";
const GARIS: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFE2E8F0" } };
const KOTAK = { top: GARIS, left: GARIS, bottom: GARIS, right: GARIS };

const isi = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** Header tabel bergaya seragam: tebal, latar abu, garis tipis. */
function gayaHeader(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: NAVY } };
    c.fill = isi(ABU);
    c.border = KOTAK;
    c.alignment = { vertical: "bottom", wrapText: true };
  });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const unit = sp.get("unit") ?? "";
  const kategori = sp.get("kategori") ?? "";
  const q = sp.get("q") ?? "";
  const semua = !unit || unit === "semua";
  const [m, p] = await Promise.all([loadMatriks(semua ? "" : unit, kategori, q), bacaPengaturan()]);

  const perKolom = new Map<string, number>();
  const perBaris = new Map<number, { n: number; jumlah: number }>();
  for (const j of m.jabatan) {
    const b = { n: 0, jumlah: 0 };
    for (const k of m.kompetensi) {
      const lv = m.level.get(`${j.id}|${k.kode}`);
      if (!lv) continue;
      b.n++;
      b.jumlah += lv;
      perKolom.set(k.kode, (perKolom.get(k.kode) ?? 0) + 1);
    }
    perBaris.set(j.id, b);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kamus Kompetensi Bank Sultra";
  wb.created = new Date();
  const lingkup = [semua ? "Semua divisi / kantor" : unit, kategori ? `kompetensi ${KATEGORI_LABEL[kategori]?.toLowerCase() ?? kategori}` : "semua kategori", q && `pencarian "${q}"`]
    .filter(Boolean)
    .join(" · ");

  // ---------- Sheet 1: Matriks
  const ws = wb.addWorksheet("Matriks", { views: [{ state: "frozen", xSplit: 4, ySplit: 5 }] });
  const TETAP = ["Divisi/Kantor", "Unit Kerja", "Kode Jabatan", "Jabatan", "Jenjang", "Jumlah Kompetensi", "Rata-rata Level"];
  const awalKomp = TETAP.length + 1;
  ws.columns = [
    { width: 28 },
    { width: 36 },
    { width: 14 },
    { width: 52 },
    { width: 22 },
    { width: 11 },
    { width: 10 },
    ...m.kompetensi.map(() => ({ width: 5.5 })),
  ];

  ws.getCell("A1").value = "Matriks Kompetensi Jabatan";
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.getCell("A2").value = `${lingkup} · ${p.edisi_judul} · diunduh ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}`;
  ws.getCell("A2").font = { color: { argb: "FF64748B" } };
  ws.getCell("A3").value = `Angka di sel = level target (${LEVEL_NAMA.map((n, i) => `${i + 1} ${n}`).join(", ")}).${m.usulan ? " Sebagian pemetaan masih usulan otomatis." : ""}`;
  ws.getCell("A3").font = { italic: true, color: { argb: "FF64748B" } };

  // baris 4: kategori (digabung per kelompok kolom)
  let mulai = awalKomp;
  for (let i = 0; i < m.kompetensi.length; i++) {
    const kat = m.kompetensi[i].kategori;
    if (i + 1 < m.kompetensi.length && m.kompetensi[i + 1].kategori === kat) continue;
    const akhir = awalKomp + i;
    if (akhir > mulai) ws.mergeCells(4, mulai, 4, akhir);
    const c = ws.getCell(4, mulai);
    c.value = KATEGORI_LABEL[kat] ?? kat;
    c.font = { bold: true, color: { argb: kat === "kepemimpinan" ? NAVY : "FFFFFFFF" } };
    c.fill = isi(KATEGORI_WARNA[kat] ?? NAVY);
    c.alignment = { horizontal: "left", vertical: "middle" };
    mulai = akhir + 1;
  }

  // baris 5: header kolom, nama kompetensi diputar 90°
  const header = ws.getRow(5);
  header.values = [...TETAP, ...m.kompetensi.map((k) => `${k.kode} ${k.nama}`)];
  header.height = 190;
  gayaHeader(header);
  for (let i = 0; i < m.kompetensi.length; i++) {
    const c = header.getCell(awalKomp + i);
    c.alignment = { textRotation: 90, vertical: "bottom", horizontal: "center", wrapText: true };
    c.font = { color: { argb: NAVY } };
  }

  for (const j of m.jabatan) {
    const b = perBaris.get(j.id)!;
    const row = ws.addRow([
      j.unit_induk_nama,
      j.unit_nama,
      j.kode,
      j.nama,
      JENJANG_LABEL[j.jenjang] ?? j.jenjang,
      b.n,
      b.n ? Math.round((b.jumlah / b.n) * 10) / 10 : null,
      ...m.kompetensi.map((k) => m.level.get(`${j.id}|${k.kode}`) ?? null),
    ]);
    row.getCell(4).font = j.jenjang <= 3 ? { bold: true } : {};
    row.getCell(4).alignment = { indent: Math.max(0, j.jenjang - 1) };
    row.getCell(7).numFmt = "0.0";
    for (let i = 0; i < m.kompetensi.length; i++) {
      const c = row.getCell(awalKomp + i);
      c.border = KOTAK;
      c.alignment = { horizontal: "center" };
      const lv = c.value as number | null;
      if (lv) {
        c.fill = isi(LEVEL_WARNA[lv - 1]);
        c.font = { bold: true, color: { argb: LEVEL_TEKS[lv - 1] } };
      }
    }
  }

  // baris penutup: jumlah jabatan yang memakai tiap kompetensi
  const dipakai = ws.addRow(["Dipakai oleh … jabatan", null, null, null, null, null, null, ...m.kompetensi.map((k) => perKolom.get(k.kode) ?? 0)]);
  dipakai.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FF64748B" } };
    c.fill = isi(ABU);
  });
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: TETAP.length } };

  // ---------- Sheet 2: Data (format panjang)
  const wd = wb.addWorksheet("Data", { views: [{ state: "frozen", ySplit: 1 }] });
  wd.columns = [
    { header: "Divisi/Kantor", width: 28 },
    { header: "Unit Kerja", width: 30 },
    { header: "Kode Jabatan", width: 14 },
    { header: "Jabatan", width: 42 },
    { header: "Jenjang", width: 22 },
    { header: "Kode Kompetensi", width: 14 },
    { header: "Kompetensi", width: 50 },
    { header: "Kategori", width: 14 },
    { header: "Level Target", width: 11 },
    { header: "Nama Level", width: 12 },
  ];
  gayaHeader(wd.getRow(1));
  for (const j of m.jabatan)
    for (const k of m.kompetensi) {
      const lv = m.level.get(`${j.id}|${k.kode}`);
      if (lv)
        wd.addRow([j.unit_induk_nama, j.unit_nama, j.kode, j.nama, JENJANG_LABEL[j.jenjang] ?? j.jenjang, k.kode, k.nama, KATEGORI_LABEL[k.kategori] ?? k.kategori, lv, LEVEL_NAMA[lv - 1]]);
    }
  wd.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } };

  // ---------- Sheet 3: Kompetensi
  const wk = wb.addWorksheet("Kompetensi", { views: [{ state: "frozen", ySplit: 1 }] });
  wk.columns = [
    { header: "Kode", width: 14 },
    { header: "Kompetensi", width: 60 },
    { header: "Kategori", width: 14 },
    { header: "Dipakai Jabatan", width: 15 },
    { header: "Porsi Jabatan", width: 13 },
  ];
  gayaHeader(wk.getRow(1));
  for (const k of m.kompetensi) {
    const n = perKolom.get(k.kode) ?? 0;
    const row = wk.addRow([k.kode, k.nama, KATEGORI_LABEL[k.kategori] ?? k.kategori, n, m.jabatan.length ? n / m.jabatan.length : 0]);
    row.getCell(5).numFmt = "0%";
  }
  wk.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 } };

  const buf = await wb.xlsx.writeBuffer();
  const nama = `matriks-kompetensi-${(semua ? "semua" : unit).toLowerCase().replace(/[^a-z0-9]+/g, "-")}${q ? "-pencarian" : ""}.xlsx`;
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nama}"`,
      "Cache-Control": "no-store",
    },
  });
}

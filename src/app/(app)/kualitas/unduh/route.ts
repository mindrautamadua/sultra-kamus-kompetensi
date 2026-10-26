import ExcelJS from "exceljs";
import { loadKualitas } from "@/lib/kualitas";

// Daftar kerja tindak lanjut cakupan jobdesk (.xlsx) untuk HC dan konsultan:
// - Butuh kompetensi lain: butir tugas yang padanannya ada di kamus tetapi belum dipetakan ke jabatannya (keputusan HC);
// - Celah kamus: butir tugas inti tanpa padanan kompetensi teknis di kamus (bahan review kamus oleh konsultan).
// Kolom Keputusan & Catatan sengaja kosong untuk diisi.

const NAVY = "FF121A42";
const GARIS: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFE2E8F0" } };
const KOTAK = { top: GARIS, left: GARIS, bottom: GARIS, right: GARIS };

function sheet(wb: ExcelJS.Workbook, nama: string, kolom: { header: string; width: number }[], baris: (string | number)[][]) {
  const ws = wb.addWorksheet(nama, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = kolom;
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: NAVY } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    c.border = KOTAK;
  });
  for (const b of baris) ws.addRow(b).eachCell({ includeEmpty: true }, (c) => (c.alignment = { vertical: "top", wrapText: true }));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: kolom.length } };
}

export async function GET() {
  const { luarBidang, celah, pemakaian } = await loadKualitas();
  const namaKomp = new Map(pemakaian.map((k) => [k.kode!, k.nama!]));
  const unit = (s: string) => s.replace(/^\d+\.\s*/, "");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kamus Kompetensi Bank Sultra";
  wb.created = new Date();
  sheet(
    wb,
    "Butuh kompetensi lain",
    [
      { header: "Divisi/Kantor", width: 26 },
      { header: "Kode Jabatan", width: 14 },
      { header: "Jabatan", width: 34 },
      { header: "No. Butir", width: 9 },
      { header: "Uraian Tugas", width: 60 },
      { header: "Kompetensi Disarankan", width: 40 },
      { header: "Alasan (analisis AI)", width: 44 },
      { header: "Keputusan HC (tambah / tidak)", width: 16 },
      { header: "Catatan", width: 30 },
    ],
    luarBidang.map((t) => [
      unit(t.jobdesk!.kelompok_unit),
      t.jobdesk!.jabatan!.kode,
      t.jobdesk!.jabatan!.nama,
      t.urutan,
      t.deskripsi,
      t.saran_kompetensi.map((k) => `${k} ${namaKomp.get(k) ?? ""}`.trim()).join("\n"),
      t.catatan_tanpa_kode ?? "",
      "",
      "",
    ]),
  );
  sheet(
    wb,
    "Celah kamus",
    [
      { header: "Divisi/Kantor", width: 26 },
      { header: "Kode Jabatan", width: 14 },
      { header: "Jabatan", width: 34 },
      { header: "No. Butir", width: 9 },
      { header: "Uraian Tugas", width: 60 },
      { header: "Alasan (analisis AI)", width: 44 },
      { header: "Usulan Konsultan (kompetensi baru / perluas kode)", width: 30 },
      { header: "Catatan", width: 30 },
    ],
    celah
      .filter((t) => t.jobdesk?.jabatan)
      .map((t) => [unit(t.jobdesk!.kelompok_unit), t.jobdesk!.jabatan!.kode, t.jobdesk!.jabatan!.nama, t.urutan, t.deskripsi, t.catatan_tanpa_kode ?? "", "", ""]),
  );

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="daftar-kerja-cakupan-jobdesk.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

import type { NextRequest } from "next/server";
import { loadLaporan } from "@/lib/dokumen/laporan-data";
import { renderLaporanPdf } from "@/lib/dokumen/laporan-pdf";
import { responPdf } from "@/lib/dokumen/respon";
import { bacaPengaturan } from "@/lib/pengaturan";

// Laporan eksekutif untuk Direksi: status kamus, pemetaan, kualitas, review, dan rekomendasi.
export async function GET(request: NextRequest) {
  const [d, p] = await Promise.all([loadLaporan(), bacaPengaturan()]);
  const tgl = d.dicetak.toLocaleDateString("sv-SE", { timeZone: "Asia/Makassar" });
  return responPdf(await renderLaporanPdf(d, p.edisi_judul), `Laporan Eksekutif Kamus Kompetensi ${tgl}.pdf`, request.nextUrl.searchParams.has("unduh"));
}

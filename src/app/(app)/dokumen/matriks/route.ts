import type { NextRequest } from "next/server";
import { perDivisi, renderMatriksPdf } from "@/lib/dokumen/matriks-pdf";
import { responPdf } from "@/lib/dokumen/respon";
import { KATEGORI_LABEL } from "@/lib/labels";
import { loadMatriks } from "@/lib/matriks";
import { bacaPengaturan } from "@/lib/pengaturan";

// Matriks kompetensi per divisi/kantor, A3 landscape (?unit=<nama unit induk> atau semua, &kategori=, &kolom=umum).
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const unit = sp.get("unit") ?? "";
  const kategori = sp.get("kategori") ?? "";
  const semua = !unit || unit === "semua";
  const [m, p] = await Promise.all([loadMatriks(semua ? "" : unit, kategori), bacaPengaturan()]);
  const divisi = perDivisi(m, sp.get("kolom") === "umum" ? "umum" : "kode").filter((d) => d.kompetensi.length > 0);
  if (!divisi.length) return new Response("Unit tidak ditemukan atau belum ada pemetaan", { status: 404 });
  const judul = `Matriks Kompetensi - ${semua ? "Semua Divisi & Kantor" : unit}`;
  const sub = kategori ? `Kompetensi ${KATEGORI_LABEL[kategori]?.toLowerCase() ?? kategori}` : "Semua kategori kompetensi";
  return responPdf(await renderMatriksPdf(divisi, { judul, sub, usulan: m.usulan, edisi: p.edisi_judul }), `${judul}.pdf`, sp.has("unduh"));
}

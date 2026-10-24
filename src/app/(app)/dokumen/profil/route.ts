import type { NextRequest } from "next/server";
import { loadProfilUnit } from "@/lib/dokumen/data";
import { renderProfilPdf } from "@/lib/dokumen/profil-pdf";
import { responPdf } from "@/lib/dokumen/respon";
import { bacaPengaturan } from "@/lib/pengaturan";

// Profil kompetensi seluruh jabatan satu divisi/kantor (?unit=<nama unit induk>), satu jabatan per dokumen.
export async function GET(request: NextRequest) {
  const unit = request.nextUrl.searchParams.get("unit") ?? "";
  const [docs, p] = await Promise.all([unit ? loadProfilUnit(unit) : [], bacaPengaturan()]);
  if (!docs.length) return new Response("Unit tidak ditemukan atau belum ada jabatan", { status: 404 });
  const judul = `Profil Kompetensi - ${unit}`;
  return responPdf(await renderProfilPdf(docs, judul, p.edisi_judul), `${judul}.pdf`, request.nextUrl.searchParams.has("unduh"));
}

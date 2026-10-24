import type { NextRequest } from "next/server";
import { loadJobdeskUnit } from "@/lib/dokumen/data";
import { renderJobdeskPdf } from "@/lib/dokumen/jobdesk-pdf";
import { responPdf } from "@/lib/dokumen/respon";

// Seluruh uraian tugas satu divisi/kantor (?unit=<nama unit induk>), satu jabatan per dokumen.
export async function GET(request: NextRequest) {
  const unit = request.nextUrl.searchParams.get("unit") ?? "";
  const docs = unit ? await loadJobdeskUnit(unit) : [];
  if (!docs.length) return new Response("Unit tidak ditemukan atau belum ada jabatan", { status: 404 });
  const judul = `Uraian Tugas - ${unit}`;
  return responPdf(await renderJobdeskPdf(docs, judul), `${judul}.pdf`, request.nextUrl.searchParams.has("unduh"));
}

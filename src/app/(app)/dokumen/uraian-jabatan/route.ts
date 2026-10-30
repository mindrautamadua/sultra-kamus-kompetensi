import type { NextRequest } from "next/server";
import { loadJobdeskSemua, loadJobdeskUnit } from "@/lib/dokumen/data";
import { responDocx } from "@/lib/dokumen/respon";
import { renderUraianDocx } from "@/lib/dokumen/uraian-docx";

// Uraian jabatan dalam satu file Word: semua jabatan, atau satu divisi/kantor (?unit=<nama unit induk>).
export async function GET(request: NextRequest) {
  const unit = request.nextUrl.searchParams.get("unit");
  const docs = unit ? await loadJobdeskUnit(unit) : await loadJobdeskSemua();
  if (!docs.length) return new Response("Unit tidak ditemukan atau belum ada jabatan", { status: 404 });
  const judul = unit ? `Uraian Jabatan - ${unit}` : "Uraian Jabatan";
  return responDocx(await renderUraianDocx(docs, judul), `${judul}.docx`);
}

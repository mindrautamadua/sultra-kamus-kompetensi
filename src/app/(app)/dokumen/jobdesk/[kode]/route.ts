import type { NextRequest } from "next/server";
import { loadJobdesk } from "@/lib/dokumen/data";
import { renderJobdeskPdf } from "@/lib/dokumen/jobdesk-pdf";
import { responPdf } from "@/lib/dokumen/respon";
import { kodeRute } from "@/lib/url";

// Uraian tugas satu jabatan (kode jabatan) dalam format dokumen sumber.
export async function GET(request: NextRequest, ctx: RouteContext<"/dokumen/jobdesk/[kode]">) {
  const { kode } = await ctx.params;
  const d = await loadJobdesk(kodeRute(kode));
  if (!d) return new Response("Jabatan tidak ditemukan", { status: 404 });
  const judul = `${d.kodeDokumen} ${d.nama}`;
  return responPdf(await renderJobdeskPdf([d], judul), `${judul}.pdf`, request.nextUrl.searchParams.has("unduh"));
}

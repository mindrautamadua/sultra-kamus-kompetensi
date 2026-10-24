import type { NextRequest } from "next/server";
import { loadKompetensi } from "@/lib/dokumen/data";
import { renderKompetensiPdf } from "@/lib/dokumen/kamus-pdf";
import { responPdf } from "@/lib/dokumen/respon";

// Satu kompetensi dalam format kamus.
export async function GET(request: NextRequest, ctx: RouteContext<"/dokumen/kompetensi/[kode]">) {
  const { kode } = await ctx.params;
  const k = await loadKompetensi(decodeURIComponent(kode));
  if (!k) return new Response("Kompetensi tidak ditemukan", { status: 404 });
  return responPdf(await renderKompetensiPdf(k), `${k.kode} ${k.nama}.pdf`, request.nextUrl.searchParams.has("unduh"));
}

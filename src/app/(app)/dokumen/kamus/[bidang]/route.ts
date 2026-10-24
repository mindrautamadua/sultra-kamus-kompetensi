import type { NextRequest } from "next/server";
import { loadKamus } from "@/lib/dokumen/data";
import { renderKamusPdf } from "@/lib/dokumen/kamus-pdf";
import { responPdf } from "@/lib/dokumen/respon";

// Kamus kompetensi satu bidang (kode bidang, mis. HCM), atau "semua".
export async function GET(request: NextRequest, ctx: RouteContext<"/dokumen/kamus/[bidang]">) {
  const { bidang } = await ctx.params;
  const data = await loadKamus(decodeURIComponent(bidang));
  if (!data.length) return new Response("Bidang tidak ditemukan", { status: 404 });
  const judul = data.length > 1 ? "Kamus Kompetensi Bank Sultra" : `Kamus Kompetensi ${data[0].kode} - ${data[0].nama}`;
  return responPdf(await renderKamusPdf(data, judul), `${judul}.pdf`, request.nextUrl.searchParams.has("unduh"));
}

import type { NextRequest } from "next/server";
import { loadProfilJabatan } from "@/lib/dokumen/data";
import { renderProfilPdf } from "@/lib/dokumen/profil-pdf";
import { responPdf } from "@/lib/dokumen/respon";
import { bacaPengaturan } from "@/lib/pengaturan";

// Profil kompetensi satu jabatan (kode jabatan).
export async function GET(request: NextRequest, ctx: RouteContext<"/dokumen/profil/[kode]">) {
  const { kode } = await ctx.params;
  const [d, p] = await Promise.all([loadProfilJabatan(decodeURIComponent(kode)), bacaPengaturan()]);
  if (!d) return new Response("Jabatan tidak ditemukan", { status: 404 });
  const judul = `Profil Kompetensi ${d.kode} ${d.nama}`;
  return responPdf(await renderProfilPdf([d], judul, p.edisi_judul), `${judul}.pdf`, request.nextUrl.searchParams.has("unduh"));
}

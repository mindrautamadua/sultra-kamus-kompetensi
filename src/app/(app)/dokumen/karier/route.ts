import type { NextRequest } from "next/server";
import { renderKarierPdf } from "@/lib/dokumen/karier-pdf";
import { responPdf } from "@/lib/dokumen/respon";
import { JALUR_KARIER_AKTIF } from "@/lib/fitur";
import { loadProfil } from "@/lib/kedekatan";
import { bacaPengaturan } from "@/lib/pengaturan";

// Peta jalur karier & kesenjangan, A3 landscape: ?asal=<kode jabatan>[&tujuan=<kode jabatan>],
// atau ?unit=<nama unit induk> untuk peta jalur seluruh jabatan satu divisi/kantor.
export async function GET(request: NextRequest) {
  if (!JALUR_KARIER_AKTIF) return new Response("Jalur karier sedang dinonaktifkan", { status: 404 });
  const sp = request.nextUrl.searchParams;
  const [semua, p] = await Promise.all([loadProfil(), bacaPengaturan()]);
  const byKode = new Map([...semua.values()].map((x) => [x.kode, x]));
  const unit = sp.get("unit");
  if (unit) {
    const asal = [...semua.values()].filter((x) => x.unitInduk === unit && x.kompetensi.size > 0);
    if (!asal.length) return new Response("Unit tidak ditemukan atau belum ada pemetaan", { status: 404 });
    const judul = `Peta Jalur Karier - ${unit}`;
    return responPdf(await renderKarierPdf(asal.map((a) => ({ asal: a, semua })), judul, p.edisi_judul), `${judul}.pdf`, sp.has("unduh"));
  }
  const asal = byKode.get(sp.get("asal") ?? "");
  if (!asal) return new Response("Jabatan asal tidak ditemukan", { status: 404 });
  const tujuan = sp.get("tujuan") ? byKode.get(sp.get("tujuan")!) : undefined;
  if (sp.get("tujuan") && !tujuan) return new Response("Jabatan tujuan tidak ditemukan", { status: 404 });
  const judul = tujuan ? `Kesenjangan Kompetensi ${asal.nama} ke ${tujuan.nama}` : `Peta Jalur Karier ${asal.kode} ${asal.nama}`;
  return responPdf(await renderKarierPdf([{ asal, tujuan, semua }], judul, p.edisi_judul), `${judul}.pdf`, sp.has("unduh"));
}

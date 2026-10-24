import type { NextRequest } from "next/server";
import { loadMatriks } from "@/lib/matriks";

// CSV dengan pemisah ";" + BOM agar langsung terbuka rapi di Excel berbahasa Indonesia.
export async function GET(request: NextRequest) {
  const unit = request.nextUrl.searchParams.get("unit") ?? "";
  const kategori = request.nextUrl.searchParams.get("kategori") ?? "";
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const m = await loadMatriks(unit === "semua" ? "" : unit, kategori, q);

  const cell = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    ["Divisi/Kantor", "Unit Kerja", "Kode Jabatan", "Jabatan", ...m.kompetensi.map((k) => `${k.kode} ${k.nama}`)],
    ...m.jabatan.map((j) => [j.unit_induk_nama, j.unit_nama, j.kode, j.nama, ...m.kompetensi.map((k) => m.level.get(`${j.id}|${k.kode}`) ?? "")]),
  ];
  const csv = "﻿" + lines.map((r) => r.map(cell).join(";")).join("\r\n");
  const nama = `matriks-kompetensi-${(unit || "semua").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nama}"` },
  });
}

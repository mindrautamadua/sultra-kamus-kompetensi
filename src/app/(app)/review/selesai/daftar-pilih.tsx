"use client";

import Link from "next/link";
import { useState } from "react";

export type Baris = { id: number; kode: string; nama: string; unit: string; jenjang: string; jumlah: number; peringatan: number; peninjau: string | null };
export type Grup = { kunci: string; judul: string; identik: boolean | null; items: Baris[] };

/** Daftar jabatan draf dengan centang per jabatan dan per grup. Dipakai di dalam ActionForm. */
export function DaftarPilih({ grup }: { grup: Grup[] }) {
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const semua = grup.flatMap((g) => g.items);
  // baris yang sudah ditandai selesai hilang dari daftar setelah aksi; jangan ikut terhitung
  const terpilih = semua.filter((b) => pilih.has(b.id));
  const atur = (ids: number[], on: boolean) =>
    setPilih((p) => {
      const n = new Set(p);
      for (const id of ids) if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const aman = semua.filter((b) => !b.peringatan).map((b) => b.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="mr-2 font-semibold text-slate-900">{terpilih.length} dari {semua.length} terpilih</span>
        <button type="button" className="btn-secondary h-8 text-[13px]" onClick={() => atur(aman, true)}>
          Pilih semua tanpa peringatan ({aman.length})
        </button>
        <button type="button" className="btn-secondary h-8 text-[13px]" onClick={() => setPilih(new Set())} disabled={!terpilih.length}>
          Kosongkan
        </button>
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {grup.map((g) => {
          const ids = g.items.map((b) => b.id);
          const n = ids.filter((id) => pilih.has(id)).length;
          return (
            <fieldset key={g.kunci} className="bg-white">
              <legend className="sr-only">{g.judul}</legend>
              <label className="flex cursor-pointer flex-wrap items-center gap-3 bg-slate-50/70 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={n === ids.length}
                  ref={(el) => {
                    if (el) el.indeterminate = n > 0 && n < ids.length;
                  }}
                  onChange={(e) => atur(ids, e.target.checked)}
                  className="accent-brand-700"
                />
                <span className="font-semibold text-slate-900">{g.judul}</span>
                <span className="text-xs text-slate-500">{ids.length} jabatan</span>
                {g.identik === true && <Lencana warna="emerald">pemetaan identik</Lencana>}
                {g.identik === false && <Lencana warna="amber">pemetaan berbeda antar jabatan</Lencana>}
              </label>
              <ul className="divide-y divide-slate-50">
                {g.items.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-2 pl-10 text-sm hover:bg-slate-50/60">
                    <input
                      type="checkbox"
                      name="jabatan_id"
                      value={b.id}
                      checked={pilih.has(b.id)}
                      onChange={(e) => atur([b.id], e.target.checked)}
                      aria-label={`${b.nama} — ${b.unit}`}
                      className="accent-brand-700"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-900">
                        {b.nama} <span className="text-slate-500">· {b.unit}</span>
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {b.jenjang} · {b.jumlah} kompetensi{b.peninjau ? ` · terakhir ${b.peninjau}` : ""}
                      </span>
                    </span>
                    {b.peringatan > 0 && (
                      <span title="Level melebihi atasan atau melebihi level yang tersedia di kamus — lihat Kualitas Pemetaan">
                        <Lencana warna="rose">{b.peringatan} peringatan</Lencana>
                      </span>
                    )}
                    <Link href={`/jabatan/${b.kode}`} target="_blank" className="link shrink-0 text-xs">
                      Periksa ↗
                    </Link>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

const WARNA = {
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
} as const;

function Lencana({ warna, children }: { warna: keyof typeof WARNA; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${WARNA[warna]}`}>{children}</span>;
}

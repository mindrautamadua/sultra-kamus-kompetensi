"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { hapusPenilaianDiri, simpanPenilaianDiri } from "@/lib/actions";
import { LEVEL_NAMA } from "@/lib/labels";
import { hitungLevel, kunciIndikator, minimalCentang } from "@/lib/penilaian";
import type { JabatanTarget, Level } from "./level-interaktif";

export type Tersimpan = { jabatanKode: string | null; dicentang: string[]; disimpan: string } | null;

const waktu = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });

/**
 * Penilaian diri: centang indikator yang sudah rutin dilakukan, perkiraan level langsung dihitung
 * (aturan di lib/penilaian.ts) dan dibandingkan dengan level target jabatan yang dipilih.
 */
export function PenilaianDiri({ kode, levels, jabatan, awal }: { kode: string; levels: Level[]; jabatan: JabatanTarget[]; awal: Tersimpan }) {
  const [buka, setBuka] = useState(awal !== null);
  const [jabatanKode, setJabatanKode] = useState(awal?.jabatanKode ?? (jabatan.length === 1 ? jabatan[0].kode : ""));
  const [centang, setCentang] = useState(() => new Set(awal?.dicentang ?? []));
  const [simpan, setSimpan] = useState<{ waktu: string; jabatanKode: string; centang: string } | null>(
    awal && { waktu: awal.disimpan, jabatanKode: awal.jabatanKode ?? "", centang: [...awal.dicentang].sort().join() },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const level = hitungLevel(
    levels.map((l) => ({ level: l.level, urutan: l.indikator.map((i) => i.urutan) })),
    centang,
  );
  const target = jabatan.find((j) => j.kode === jabatanKode)?.level ?? null;
  const selisih = target === null ? null : level - target;
  const berubah = !simpan || simpan.jabatanKode !== jabatanKode || simpan.centang !== [...centang].sort().join();

  // indikator yang belum dicentang dari level berikutnya sampai target: bahan rencana pengembangan
  const fokus = levels.filter((l) => l.level > level && l.level <= (target ?? level + 1)).flatMap((l) => l.indikator.filter((i) => !centang.has(kunciIndikator(l.level, i.urutan))).map((i) => ({ ...i, level: l.level })));

  function toggle(k: string) {
    const next = new Set(centang);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setCentang(next);
  }

  function kirim() {
    setError(null);
    start(async () => {
      const r = await simpanPenilaianDiri(kode, jabatanKode || null, [...centang]);
      if (r.error) setError(r.error);
      else setSimpan({ waktu: r.disimpan!, jabatanKode, centang: [...centang].sort().join() });
    });
  }

  function hapus() {
    if (!confirm("Hapus penilaian diri untuk kompetensi ini?")) return;
    setError(null);
    start(async () => {
      const r = await hapusPenilaianDiri(kode);
      if (r.error) return setError(r.error);
      setSimpan(null);
      setCentang(new Set());
    });
  }

  if (levels.every((l) => l.indikator.length === 0)) return null;

  return (
    <section id="penilaian" className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">Penilaian diri</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">Centang indikator yang sudah rutin Anda lakukan untuk memperkirakan level Anda.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {simpan && <span className="text-slate-500">Tersimpan {waktu(simpan.waktu)}</span>}
          <Link href="/penilaian-diri" className="font-medium text-brand-700 hover:underline">
            Semua penilaian
          </Link>
        </div>
      </div>

      {!buka ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-slate-600">Belum ada penilaian diri untuk kompetensi ini.</p>
          <button type="button" onClick={() => setBuka(true)} className="btn-primary h-9 text-[13px]">
            Mulai penilaian diri
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ol className="divide-y divide-slate-100 lg:border-r lg:border-slate-200">
            {levels.map((l) => {
              const n = l.indikator.filter((i) => centang.has(kunciIndikator(l.level, i.urutan))).length;
              const butuh = minimalCentang(l.indikator.length);
              const tercapai = l.level <= level;
              return (
                <li key={l.level} className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`grid size-7 place-items-center rounded-full text-[13px] font-semibold ${tercapai ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600"}`}>{l.level}</span>
                    <h3 className="font-semibold text-slate-900">{l.nama_level}</h3>
                    {target === l.level && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Target jabatan</span>}
                    <span className="ml-auto text-xs tabular-nums text-slate-500">
                      {l.indikator.length ? `${n}/${l.indikator.length} dicentang · butuh ${butuh}` : "belum ada indikator"}
                    </span>
                  </div>
                  {l.indikator.length > 0 && (
                    <>
                      <div className="mb-3 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                        <div className={`h-full rounded-full transition-all ${n >= butuh ? "bg-brand-600" : "bg-brand-300"}`} style={{ width: `${(n / l.indikator.length) * 100}%` }} />
                      </div>
                      <ul className="space-y-1">
                        {l.indikator.map((i) => {
                          const k = kunciIndikator(l.level, i.urutan);
                          return (
                            <li key={k}>
                              <label className="flex cursor-pointer gap-3 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                                <input type="checkbox" checked={centang.has(k)} onChange={() => toggle(k)} className="mt-0.5 size-4 shrink-0 accent-brand-700" />
                                <span className="leading-relaxed">{i.deskripsi}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </li>
              );
            })}
          </ol>

          <aside className="space-y-4 border-t border-slate-200 bg-slate-50/50 p-4 lg:sticky lg:top-0 lg:self-start lg:border-t-0 lg:bg-transparent">
            <label className="field-label">
              Bandingkan dengan jabatan
              <select value={jabatanKode} onChange={(e) => setJabatanKode(e.target.value)} className="field">
                <option value="">Tanpa jabatan</option>
                {jabatan.map((j) => (
                  <option key={j.kode} value={j.kode}>
                    {j.nama} (target {j.level})
                  </option>
                ))}
              </select>
            </label>
            {jabatan.length === 0 && <p className="text-xs text-slate-500">Kompetensi ini belum dipetakan ke jabatan, jadi belum ada target pembanding.</p>}

            <div className="rounded-xl border border-slate-200 bg-white p-4" aria-live="polite">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Perkiraan level Anda</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-heading text-4xl font-semibold tabular-nums text-slate-900">{level}</span>
                <span className="font-medium text-slate-600">{level ? LEVEL_NAMA[level - 1] : "Belum mencapai level 1"}</span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1" aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={`relative h-2 rounded-full ${i <= level ? "bg-brand-600" : "bg-slate-200"}`}>
                    {i === target && <span className="absolute -inset-1 rounded-full ring-2 ring-amber-400" />}
                  </span>
                ))}
              </div>
              {selisih !== null && (
                <p className={`mt-3 text-sm font-medium ${selisih >= 0 ? "text-emerald-700" : "text-amber-800"}`}>
                  {selisih >= 0 ? (selisih === 0 ? "Sesuai target jabatan" : `${selisih} level di atas target`) : `Kurang ${-selisih} level dari target (${target})`}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">Level tercapai bila minimal 2/3 indikatornya dicentang, berurutan dari level 1.</p>
            </div>

            {fokus.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Fokus pengembangan</div>
                <ul className="space-y-1 text-[13px] text-slate-700">
                  {fokus.slice(0, 6).map((f) => (
                    <li key={kunciIndikator(f.level, f.urutan)} className="flex gap-2">
                      <span className="shrink-0 font-mono text-[11px] text-slate-500">L{f.level}</span>
                      <span className="line-clamp-2">{f.deskripsi}</span>
                    </li>
                  ))}
                </ul>
                {fokus.length > 6 && <p className="mt-1 text-xs text-slate-500">dan {fokus.length - 6} indikator lain</p>}
              </div>
            )}

            {error && <p className="text-sm text-rose-700">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={kirim} disabled={pending || !berubah} className="btn-primary h-9 text-[13px] disabled:opacity-60">
                {pending ? "Menyimpan…" : berubah ? "Simpan penilaian" : "Tersimpan"}
              </button>
              {simpan && (
                <button type="button" onClick={hapus} disabled={pending} className="px-2 text-[13px] font-medium text-rose-700 hover:underline">
                  Hapus
                </button>
              )}
              {berubah && simpan && <span className="text-xs text-amber-700">Ada perubahan belum disimpan</span>}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

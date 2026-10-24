"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";

export type Level = { level: number; nama_level: string; deskripsi: string | null; indikator: { urutan: number; deskripsi: string }[] };
export type JabatanTarget = { kode: string; nama: string; level: number };
type Mode = "satu" | "banding" | "semua";

const MODE: { v: Mode; label: string }[] = [
  { v: "satu", label: "Per level" },
  { v: "banding", label: "Bandingkan" },
  { v: "semua", label: "Semua level" },
];

// Warna kolom kiri/kanan saat membandingkan; dipakai juga di tangga supaya pasangan pilihan mudah dikenali.
const WARNA = ["bg-brand-700 text-white ring-brand-700", "bg-amber-400 text-amber-950 ring-amber-500"];

/**
 * Tangga level 1–5 yang bisa diklik, mode bandingkan dua level, dan sebaran level target jabatan.
 * Level aktif disimpan di hash URL (#level-3) supaya tautan bisa dibagikan.
 */
export function LevelInteraktif({ levels, jabatan }: { levels: Level[]; jabatan: JabatanTarget[] }) {
  const [mode, setMode] = useState<Mode>("satu");
  // pilihan terakhir di ujung; mode bandingkan memakai dua pilihan terakhir. Sebelum ada klik, level awal dari hash.
  const [dipilih, setPilihan] = useState<number[] | null>(null);
  const hash = useSyncExternalStore(langgananHash, () => window.location.hash, () => "");
  const [filterJabatan, setFilterJabatan] = useState<number | null>(null);
  const tangga = useRef<HTMLDivElement>(null);

  const dariHash = Number(/^#level-(\d)$/.exec(hash)?.[1]);
  const pilihan = dipilih ?? [levels.some((l) => l.level === dariHash) ? dariHash : (levels[0]?.level ?? 1)];
  const aktif = pilihan.at(-1)!;
  const banding = [...new Set(pilihan.slice(-2))].sort((a, b) => a - b);

  function pilih(n: number) {
    setPilihan(mode === "banding" ? [...pilihan.filter((x) => x !== n), n].slice(-2) : [n]);
    window.history.replaceState(null, "", `#level-${n}`);
  }

  function gantiMode(m: Mode) {
    setMode(m);
    // masuk mode bandingkan dengan pasangan level berikutnya, kasus yang paling sering ditanyakan (mis. 3 vs 4)
    if (m === "banding" && pilihan.length < 2) {
      const lain = levels.find((l) => l.level === aktif + 1) ?? levels.find((l) => l.level === aktif - 1);
      if (lain) setPilihan([aktif, lain.level]);
    }
  }

  function onKeyTangga(e: React.KeyboardEvent) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d || mode === "semua") return;
    e.preventDefault();
    const i = levels.findIndex((l) => l.level === aktif);
    const next = levels[Math.min(levels.length - 1, Math.max(0, i + d))];
    pilih(next.level);
    tangga.current?.querySelector<HTMLButtonElement>(`[data-level="${next.level}"]`)?.focus();
  }

  const perLevel = (n: number) => jabatan.filter((j) => j.level === n).length;
  const maxPerLevel = Math.max(1, ...levels.map((l) => perLevel(l.level)));

  if (levels.length === 0)
    return <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Tabel level kompetensi belum disusun.</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">Level kompetensi</h2>
          <div className="flex rounded-lg border border-slate-300 p-0.5" role="group" aria-label="Cara menampilkan level">
            {MODE.map((m) => (
              <button
                key={m.v}
                type="button"
                aria-pressed={mode === m.v}
                onClick={() => gantiMode(m.v)}
                className={`h-8 rounded-md px-3 text-[13px] font-medium ${mode === m.v ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {mode !== "semua" && (
          <div className="border-b border-slate-100 px-4 pt-5 pb-4">
            <div ref={tangga} onKeyDown={onKeyTangga} className="grid grid-cols-5 items-end gap-2" role="group" aria-label="Pilih level">
              {levels.map((l) => {
                const idx = mode === "banding" ? banding.indexOf(l.level) : l.level === aktif ? 0 : -1;
                const n = perLevel(l.level);
                return (
                  <button
                    key={l.level}
                    type="button"
                    data-level={l.level}
                    aria-pressed={idx !== -1}
                    tabIndex={l.level === aktif ? 0 : -1}
                    onClick={() => pilih(l.level)}
                    className="group flex flex-col items-stretch gap-2 text-left"
                  >
                    <span
                      style={{ height: `${28 + l.level * 14}px` }}
                      className={`flex items-start justify-between rounded-lg px-2.5 py-2 ring-1 ring-inset transition-all ${
                        idx !== -1 ? `${WARNA[idx]} shadow-md` : "bg-brand-50 text-brand-800 ring-brand-100 group-hover:bg-brand-100"
                      }`}
                    >
                      <span className="font-heading text-lg leading-none font-semibold">{l.level}</span>
                      {n > 0 && (
                        <span className="rounded-full bg-white/20 px-1.5 text-[11px] font-semibold tabular-nums ring-1 ring-current/20 ring-inset" title={`${n} jabatan menargetkan level ini`}>
                          {n}
                        </span>
                      )}
                    </span>
                    <span className={`truncate text-[13px] font-semibold ${idx !== -1 ? "text-slate-900" : "text-slate-500 group-hover:text-slate-800"}`}>{l.nama_level}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {mode === "banding" ? "Klik dua level untuk dibandingkan berdampingan." : "Klik level atau pakai tombol panah ← → untuk berpindah."}
            </p>
          </div>
        )}

        <div className="p-4">
          {mode === "satu" && <PanelLevel l={levels.find((l) => l.level === aktif)!} n={perLevel(aktif)} onJabatan={() => setFilterJabatan(aktif)} />}
          {mode === "banding" && (
            <div className="grid gap-4 md:grid-cols-2">
              {banding.map((n, i) => (
                <div key={n} className={`rounded-lg p-4 ring-1 ring-inset ${i === 0 ? "bg-brand-50/50 ring-brand-100" : "bg-amber-50/60 ring-amber-200"}`}>
                  <PanelLevel l={levels.find((l) => l.level === n)!} n={perLevel(n)} onJabatan={() => setFilterJabatan(n)} warna={i} />
                </div>
              ))}
              {banding.length < 2 && <div className="grid place-items-center rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">Pilih satu level lagi.</div>}
            </div>
          )}
          {mode === "semua" && (
            <ol className="divide-y divide-slate-100">
              {levels.map((l) => (
                <li key={l.level} className="py-4 first:pt-0 last:pb-0">
                  <PanelLevel l={l} n={perLevel(l.level)} onJabatan={() => setFilterJabatan(l.level)} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <SebaranJabatan jabatan={jabatan} levels={levels} max={maxPerLevel} perLevel={perLevel} filter={filterJabatan} setFilter={setFilterJabatan} />
    </div>
  );
}

function langgananHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function PanelLevel({ l, n, onJabatan, warna = 0 }: { l: Level; n: number; onJabatan: () => void; warna?: number }) {
  const [tersalin, setTersalin] = useState(false);

  async function salin() {
    const teks = [`Level ${l.level} – ${l.nama_level}`, l.deskripsi ?? "", ...l.indikator.map((i) => `• ${i.deskripsi}`)].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 1600);
    } catch {}
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <div className="flex items-center gap-2">
          <span className={`grid size-8 place-items-center rounded-full text-sm font-semibold ring-1 ring-inset ${WARNA[warna]}`}>{l.level}</span>
          <h3 className="font-semibold text-slate-900">{l.nama_level}</h3>
        </div>
        <LevelBar level={l.level} />
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{l.deskripsi ?? <i className="text-slate-500">Deskripsi belum tersedia.</i>}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={salin} className="btn-secondary h-8 px-3 text-[13px]" aria-live="polite">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-4" aria-hidden>
              {tersalin ? <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M7 7V4.5h8.5V13H13M4.5 7H13v8.5H4.5z" strokeLinejoin="round" />}
            </svg>
            {tersalin ? "Tersalin" : "Salin level"}
          </button>
          {n > 0 && (
            <a href="#jabatan" onClick={onJabatan} className="btn-secondary h-8 px-3 text-[13px]">
              {n} jabatan di level ini
            </a>
          )}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Indikator perilaku · {l.indikator.length}</div>
        {l.indikator.length ? (
          <ul className="space-y-1.5 text-sm text-slate-700">
            {l.indikator.map((i) => (
              <li key={i.urutan} className="flex gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 tabular-nums">{i.urutan}</span>
                <span className="leading-relaxed">{i.deskripsi}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-slate-500">Belum ada indikator.</p>
        )}
      </div>
    </div>
  );
}

function SebaranJabatan({
  jabatan,
  levels,
  max,
  perLevel,
  filter,
  setFilter,
}: {
  jabatan: JabatanTarget[];
  levels: Level[];
  max: number;
  perLevel: (n: number) => number;
  filter: number | null;
  setFilter: (n: number | null) => void;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const tampil = jabatan
    .filter((j) => (filter === null || j.level === filter) && (!term || `${j.kode} ${j.nama}`.toLowerCase().includes(term)))
    .sort((a, b) => b.level - a.level || a.nama.localeCompare(b.nama));

  return (
    <section id="jabatan" className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">Dipetakan ke jabatan</h2>
        <span className="text-xs text-slate-500 tabular-nums">{jabatan.length} jabatan</span>
      </div>
      {jabatan.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">Belum dipetakan ke jabatan mana pun.</p>
      ) : (
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="border-b border-slate-100 p-4 md:border-r md:border-b-0">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Sebaran level target</div>
            <ul className="space-y-1.5">
              {levels.map((l) => {
                const n = perLevel(l.level);
                const on = filter === l.level;
                return (
                  <li key={l.level}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={n === 0}
                      onClick={() => setFilter(on ? null : l.level)}
                      className={`grid w-full grid-cols-[5.5rem_1fr_2rem] items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] disabled:cursor-default disabled:opacity-50 ${on ? "bg-brand-50 ring-1 ring-brand-200 ring-inset" : "enabled:hover:bg-slate-50"}`}
                    >
                      <span className="truncate text-slate-700">
                        <b className="font-semibold">{l.level}</b> {l.nama_level}
                      </span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <span className={`block h-full rounded-full transition-all ${on ? "bg-brand-700" : "bg-brand-400"}`} style={{ width: `${(n / max) * 100}%` }} />
                      </span>
                      <span className="text-right font-semibold text-slate-800 tabular-nums">{n}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {filter !== null && (
              <button type="button" onClick={() => setFilter(null)} className="mt-2 px-2 text-xs font-medium text-brand-700 hover:underline">
                Tampilkan semua level
              </button>
            )}
          </div>
          <div className="min-w-0">
            {jabatan.length > 8 && (
              <div className="border-b border-slate-100 p-2">
                <label className="block">
                  <span className="sr-only">Cari jabatan</span>
                  <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari jabatan…" className="field h-9 w-full" />
                </label>
              </div>
            )}
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto text-sm">
              {tampil.map((j) => (
                <li key={j.kode} className="flex items-center justify-between gap-3 px-4 py-2">
                  <Link href={`/jabatan/${j.kode}`} className="min-w-0 truncate hover:text-brand-700 hover:underline">
                    {j.nama}
                  </Link>
                  <span className={`lv${j.level} shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold`}>Level {j.level}</span>
                </li>
              ))}
              {tampil.length === 0 && <li className="px-4 py-4 text-slate-500">Tidak ada jabatan yang cocok.</li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function LevelBar({ level }: { level: number }) {
  return (
    <div className="mt-3 flex max-w-48 gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= level ? "bg-brand-600" : "bg-slate-200"}`} />
      ))}
    </div>
  );
}

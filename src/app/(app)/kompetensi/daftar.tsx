"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { StatusBadge, Tag } from "@/components/ui";
import { KATEGORI_LABEL, LEVEL_NAMA, fmt } from "@/lib/labels";

export type Item = {
  kode: string;
  nama: string;
  definisi: string | null;
  status: string;
  tanda_c: boolean;
  catatan: string[];
  kategori: string;
  bidang_kode: string;
  bidang_nama: string;
  jumlah_indikator: number;
  jumlah_jabatan: number;
  /** jumlah jabatan per level target, indeks 0 = level 1 */
  level: number[];
};
export type Bidang = { kode: string; nama: string; kategori: string };
export type Fokus = "" | "perlu" | "belum_dipetakan";
type Tampilan = "daftar" | "kartu";
type Urut = "kamus" | "terbanyak" | "tersedikit" | "level";

const FOKUS: {
  v: Fokus;
  label: string;
  hint: string;
  cocok: (i: Item) => boolean;
}[] = [
  {
    v: "",
    label: "Semua kompetensi",
    hint: "di seluruh bidang",
    cocok: () => true,
  },
  {
    v: "perlu",
    label: "Perlu dilengkapi",
    hint: "draft, usulan, atau belum disusun",
    cocok: (i) => i.status !== "lengkap" && i.status !== "dihapus",
  },
  {
    v: "belum_dipetakan",
    label: "Belum dipetakan",
    hint: "kompetensi teknis lengkap yang belum jadi target jabatan",
    // sama dengan angka di kartu statistik: hanya teknis berstatus Lengkap yang bisa dipetakan
    cocok: (i) => i.kategori === "teknis" && i.status === "lengkap" && i.jumlah_jabatan === 0,
  },
];

const URUT: { v: Urut; label: string }[] = [
  { v: "kamus", label: "Urutan kamus" },
  { v: "terbanyak", label: "Paling banyak dipakai" },
  { v: "tersedikit", label: "Paling jarang dipakai" },
  { v: "level", label: "Level target tertinggi" },
];

const KATEGORI = ["inti", "kepemimpinan", "teknis"];
const KATEGORI_HINT: Record<string, string> = {
  inti: "wajib bagi semua jabatan",
  kepemimpinan: "untuk jabatan struktural",
  teknis: "per bidang pekerjaan",
};

const TAMPILAN_KEY = "kompetensi:tampilan";

// Pilihan tampilan diingat per browser; dibaca lewat useSyncExternalStore agar render server tetap "daftar".
function bacaTampilan(): Tampilan {
  try {
    return localStorage.getItem(TAMPILAN_KEY) === "kartu" ? "kartu" : "daftar";
  } catch {
    return "daftar";
  }
}
function langgananTampilan(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(TAMPILAN_KEY, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(TAMPILAN_KEY, cb);
  };
}

const jumlah = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** rata-rata level target (1–5), null bila belum dipetakan */
const rataLevel = (lv: number[]) => {
  const n = jumlah(lv);
  return n ? lv.reduce((s, c, i) => s + c * (i + 1), 0) / n : null;
};
const persen = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const satuDesimal = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// hanya kompetensi berstatus lengkap yang bisa dipetakan ke jabatan
const bisaDipetakan = (i: Item) => i.status === "lengkap";

// Daftar kamus disaring di browser (±300 baris): hasil langsung berubah saat mengetik, filter disalin ke URL.
export function DaftarKompetensi({
  items,
  bidang,
  totalJabatan,
  usulan,
  awal,
}: {
  items: Item[];
  bidang: Bidang[];
  totalJabatan: number;
  /** jumlah pemetaan jabatan–kompetensi yang masih usulan otomatis */
  usulan: number;
  awal: { q: string; kategori: string; bidang: string; fokus: Fokus };
}) {
  const [q, setQ] = useState(awal.q);
  const [kategoriAktif, setKategoriAktif] = useState(KATEGORI.includes(awal.kategori) ? awal.kategori : "");
  const [bidangAktif, setBidangAktif] = useState(awal.bidang);
  const [fokus, setFokus] = useState<Fokus>(awal.fokus);
  const [urut, setUrut] = useState<Urut>("kamus");
  const tampilan = useSyncExternalStore(langgananTampilan, bacaTampilan, () => "daftar" as const);
  const cari = useRef<HTMLInputElement>(null);
  const term = useDeferredValue(q.trim().toLowerCase());

  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (kategoriAktif) p.set("kategori", kategoriAktif);
    if (bidangAktif) p.set("bidang", bidangAktif);
    if (fokus) p.set("fokus", fokus);
    const s = p.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }, [q, kategoriAktif, bidangAktif, fokus]);

  // "/" memindahkan fokus ke kotak pencarian (seperti di banyak aplikasi), kecuali saat sedang mengetik
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || t.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      cari.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pilihTampilan(t: Tampilan) {
    try {
      localStorage.setItem(TAMPILAN_KEY, t);
    } catch {}
    window.dispatchEvent(new Event(TAMPILAN_KEY));
  }

  const statistik = useMemo(() => hitungStatistik(items, bidang), [items, bidang]);
  const maxJabatan = Math.max(1, ...items.filter((i) => i.kategori === "teknis").map((i) => i.jumlah_jabatan));

  const cocokCari = useMemo(() => (term ? items.filter((i) => `${i.kode} ${i.nama} ${i.definisi ?? ""}`.toLowerCase().includes(term)) : items), [items, term]);
  const cocokFokus = FOKUS.find((f) => f.v === fokus)!.cocok;
  const cocokKategori = (i: Item) => !kategoriAktif || i.kategori === kategoriAktif;
  const hasil = cocokCari.filter((i) => cocokFokus(i) && cocokKategori(i) && (!bidangAktif || i.bidang_kode === bidangAktif));

  // angka di tab kategori, kartu bidang & tombol fokus mengikuti filter lain, supaya terlihat ke mana hasil akan bergeser
  const perKategori = new Map<string, number>();
  const perBidang = new Map<string, number>();
  for (const i of cocokCari)
    if (cocokFokus(i)) {
      perKategori.set(i.kategori, (perKategori.get(i.kategori) ?? 0) + 1);
      perBidang.set(i.bidang_kode, (perBidang.get(i.bidang_kode) ?? 0) + 1);
    }
  const dasarFokus = cocokCari.filter((i) => cocokKategori(i) && (!bidangAktif || i.bidang_kode === bidangAktif));
  const bidangTampil = statistik.bidang.filter((b) => !kategoriAktif || b.kategori === kategoriAktif);

  // urutan kamus: kategori -> bidang -> kompetensi; urutan lain: satu daftar rata
  const groups = new Map<string, Map<string, Item[]>>();
  for (const r of hasil) {
    const g = groups.get(r.kategori) ?? new Map<string, Item[]>();
    g.set(r.bidang_kode, [...(g.get(r.bidang_kode) ?? []), r]);
    groups.set(r.kategori, g);
  }
  const urutKategori = [...groups.keys()].sort((a, b) => KATEGORI.indexOf(a) - KATEGORI.indexOf(b));
  const terurut =
    urut === "kamus"
      ? hasil
      : [...hasil].sort((a, b) =>
          urut === "terbanyak"
            ? b.jumlah_jabatan - a.jumlah_jabatan
            : urut === "tersedikit"
              ? a.jumlah_jabatan - b.jumlah_jabatan
              : (rataLevel(b.level) ?? 0) - (rataLevel(a.level) ?? 0),
        );

  function pilihKategori(k: string) {
    setKategoriAktif(k);
    // bidang yang dipilih harus berada di kategori ini
    if (k && bidang.find((b) => b.kode === bidangAktif)?.kategori !== k) setBidangAktif("");
  }
  function pilihFokus(f: Fokus) {
    setFokus(fokus === f ? "" : f);
    document.getElementById("daftar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const adaFilter = q || kategoriAktif || bidangAktif || fokus;
  const kartu = (k: Item) => <KartuKompetensi key={k.kode} k={k} term={term} />;
  const baris = (k: Item) => <BarisKompetensi key={k.kode} k={k} term={term} maxJabatan={maxJabatan} totalJabatan={totalJabatan} />;

  return (
    <div className="space-y-6">
      <Hero s={statistik} totalJabatan={totalJabatan} usulan={usulan} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TerbanyakDipakai s={statistik} totalJabatan={totalJabatan} />
        <SebaranLevel level={statistik.level} />
        <PerluPerhatian s={statistik} fokus={fokus} onFokus={pilihFokus} />
      </div>

      <div id="daftar" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:grid-cols-4" role="group" aria-label="Kategori kompetensi">
          {["", ...KATEGORI].map((k) => {
            const on = kategoriAktif === k;
            const n = k ? (perKategori.get(k) ?? 0) : jumlah([...perKategori.values()]);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => pilihKategori(k)}
                className={`rounded-md px-3 py-2 text-left transition-colors ${on ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/60"}`}
              >
                <div className={`flex items-baseline justify-between gap-2 text-sm font-semibold ${on ? "text-brand-700" : "text-slate-800"}`}>
                  {k ? KATEGORI_LABEL[k] : "Semua kategori"}
                  <span className={`tabular-nums text-xs font-medium ${on ? "text-brand-600" : "text-slate-500"}`}>{n}</span>
                </div>
                <div className="truncate text-xs text-slate-500">{k ? KATEGORI_HINT[k] : "inti, kepemimpinan & teknis"}</div>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Cari kompetensi</span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13 13l4 4" strokeLinecap="round" />
            </svg>
            <input
              ref={cari}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, kode, atau isi definisi…"
              className="field w-full pr-10 pl-9"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[11px] text-slate-500 sm:block">
              /
            </kbd>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="sr-only sm:not-sr-only">Urutkan</span>
            <select value={urut} onChange={(e) => setUrut(e.target.value as Urut)} className="field w-auto">
              {URUT.map((u) => (
                <option key={u.v} value={u.v}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex rounded-lg border border-slate-300 p-0.5" role="group" aria-label="Tampilan">
            {(["daftar", "kartu"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tampilan === t}
                onClick={() => pilihTampilan(t)}
                className={`flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium capitalize ${tampilan === t ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-4" aria-hidden>
                  {t === "daftar" ? (
                    <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" strokeLinecap="round" />
                  ) : (
                    <path d="M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM11.5 11.5h5v5h-5z" strokeLinejoin="round" />
                  )}
                </svg>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-3 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Peta bidang</h2>
          <span className="text-xs text-slate-500">batang = porsi kompetensi yang sudah dipakai jabatan</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Bidang">
          {bidangTampil.map((b) => (
            <KartuBidang
              key={b.kode}
              b={b}
              n={perBidang.get(b.kode) ?? 0}
              on={bidangAktif === b.kode}
              onClick={() => setBidangAktif(bidangAktif === b.kode ? "" : b.kode)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500" aria-live="polite">
        <span>
          <b className="font-semibold text-slate-800 tabular-nums">{hasil.length}</b> kompetensi
          {kategoriAktif && !bidangAktif && <> {KATEGORI_LABEL[kategoriAktif].toLowerCase()}</>}
          {bidangAktif && <> di {bidang.find((b) => b.kode === bidangAktif)?.nama}</>}
          {fokus && <> · {FOKUS.find((f) => f.v === fokus)!.label.toLowerCase()}</>}
          {dasarFokus.length !== hasil.length && <span className="text-slate-400"> dari {dasarFokus.length}</span>}
        </span>
        {adaFilter && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setKategoriAktif("");
              setBidangAktif("");
              setFokus("");
            }}
            className="font-medium text-brand-700 hover:underline"
          >
            Reset filter
          </button>
        )}
        <span className="ml-auto hidden items-center gap-1.5 text-xs sm:flex">
          Level target:
          {LEVEL_NAMA.map((n, i) => (
            <span key={n} className={`lv${i + 1} grid size-4 place-items-center rounded-sm text-[10px] font-semibold`} title={`Level ${i + 1} — ${n}`}>
              {i + 1}
            </span>
          ))}
        </span>
      </div>

      {hasil.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          Tidak ada kompetensi yang cocok dengan filter.
        </div>
      )}

      {urut !== "kamus" ? (
        tampilan === "daftar" ? (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">{terurut.map(baris)}</ul>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{terurut.map(kartu)}</ul>
        )
      ) : (
        urutKategori.map((kat) => (
          <div key={kat} className="space-y-5">
            <h2 className="flex items-baseline gap-2 border-b border-slate-200 pb-2 font-heading text-lg font-semibold text-slate-900">
              Kompetensi {KATEGORI_LABEL[kat] ?? kat}
              <span className="text-sm font-normal text-slate-500">
                · {jumlah([...groups.get(kat)!.values()].map((r) => r.length))} kompetensi
                {kat === "teknis" ? ` di ${groups.get(kat)!.size} bidang` : ""}
              </span>
            </h2>
            {[...groups.get(kat)!.entries()].map(([kode, rows]) => (
              <section key={kode}>
                <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-slate-800">
                  <span className="font-mono text-xs text-slate-500">{kode}</span>
                  {rows[0].bidang_nama}
                  <span className="font-normal text-slate-500">· {rows.length}</span>
                  <a href={`/dokumen/kamus/${kode}`} target="_blank" rel="noopener" className="ml-auto text-xs font-medium text-brand-700 hover:underline">
                    Kamus bidang (PDF)
                  </a>
                </h3>
                {tampilan === "daftar" ? (
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">{rows.map(baris)}</ul>
                ) : (
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(kartu)}</ul>
                )}
              </section>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

type StatBidang = Bidang & { jumlah: number; dipakai: number; bisa: number; rata: number | null };
type Statistik = ReturnType<typeof hitungStatistik>;

function hitungStatistik(items: Item[], bidang: Bidang[]) {
  const aktif = items.filter((i) => i.status !== "dihapus");
  const teknis = aktif.filter((i) => i.kategori === "teknis" && bisaDipetakan(i));
  const level = [0, 0, 0, 0, 0];
  for (const i of aktif) i.level.forEach((c, j) => (level[j] += c));
  const perBidang: StatBidang[] = bidang.map((b) => {
    const rows = aktif.filter((i) => i.bidang_kode === b.kode);
    const bisa = rows.filter(bisaDipetakan);
    const lv = [0, 0, 0, 0, 0];
    for (const i of rows) i.level.forEach((c, j) => (lv[j] += c));
    return { ...b, jumlah: rows.length, bisa: bisa.length, dipakai: bisa.filter((i) => i.jumlah_jabatan > 0).length, rata: rataLevel(lv) };
  });
  const teknisBidang = perBidang.filter((b) => b.kategori === "teknis" && b.bisa);
  return {
    kompetensi: aktif.length,
    indikator: jumlah(aktif.map((i) => i.jumlah_indikator)),
    bidangTeknis: teknisBidang.length,
    teknis: teknis.length,
    teknisDipakai: teknis.filter((i) => i.jumlah_jabatan > 0).length,
    pemetaan: jumlah(level),
    level,
    bidang: perBidang,
    top: [...teknis].sort((a, b) => b.jumlah_jabatan - a.jumlah_jabatan).slice(0, 5),
    belum: items.filter(FOKUS[2].cocok).length,
    perlu: items.filter(FOKUS[1].cocok).length,
    // bidang teknis dengan porsi kompetensi tak terpakai terbesar
    bidangSepi: [...teknisBidang].sort((a, b) => a.dipakai / a.bisa - b.dipakai / b.bisa)[0],
  };
}

function Hero({ s, totalJabatan, usulan }: { s: Statistik; totalJabatan: number; usulan: number }) {
  const p = persen(s.teknisDipakai, s.teknis);
  const r = 52;
  const keliling = 2 * Math.PI * r;
  const angka = [
    { n: s.kompetensi, label: "kompetensi" },
    { n: s.bidangTeknis, label: "bidang teknis" },
    { n: s.indikator, label: "indikator perilaku" },
    { n: s.pemetaan, label: "pemetaan jabatan" },
  ];
  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900" aria-label="Ringkasan kamus">
      {/* cahaya dekoratif */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
      <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Isi kamus</div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {angka.map((a, i) => (
              <div key={a.label} className="flex animate-[masuk_0.4s_ease-out_both] flex-col-reverse" style={{ animationDelay: `${i * 70}ms` }}>
                <dt className="text-xs text-brand-200">{a.label}</dt>
                <dd className="font-heading text-3xl font-semibold tabular-nums">{fmt(a.n)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-brand-200">
            Rata-rata <b className="text-white">{satuDesimal(s.indikator / Math.max(1, s.kompetensi))}</b> indikator per kompetensi dan{" "}
            <b className="text-white">{satuDesimal(s.pemetaan / Math.max(1, totalJabatan))}</b> kompetensi per jabatan.
            {usulan > 0 && (
              <>
                {" "}
                <span className="text-amber-200">
                  {Math.min(100, persen(usulan, s.pemetaan))}% pemetaan masih usulan otomatis
                </span>{" "}
                dan menunggu tinjauan.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="relative size-32 shrink-0">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/10" />
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke="var(--color-amber-400)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={keliling}
                strokeDashoffset={keliling * (1 - p / 100)}
                className="animate-[lingkar_1.1s_ease-out_both]"
                style={{ "--penuh": keliling } as React.CSSProperties}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="font-heading text-2xl font-semibold tabular-nums">{p}%</div>
                <div className="text-[10px] uppercase tracking-wide text-brand-200">terpakai</div>
              </div>
            </div>
          </div>
          <p className="max-w-48 text-sm leading-snug text-brand-200">
            <b className="text-white">{fmt(s.teknisDipakai)}</b> dari {fmt(s.teknis)} kompetensi teknis sudah menjadi target minimal satu jabatan.
          </p>
        </div>
      </div>
    </section>
  );
}

function KartuInsight({ judul, children, aksi }: { judul: string; children: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">{judul}</h2>
        {aksi}
      </div>
      {children}
    </section>
  );
}

function TerbanyakDipakai({ s, totalJabatan }: { s: Statistik; totalJabatan: number }) {
  const max = Math.max(1, s.top[0]?.jumlah_jabatan ?? 0);
  return (
    <KartuInsight judul="Teknis paling banyak dipakai">
      {s.top.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada pemetaan.</p>
      ) : (
        <ol className="space-y-2.5">
          {s.top.map((k, i) => (
            <li key={k.kode}>
              <Link href={`/kompetensi/${k.kode}`} className="group block">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="w-4 shrink-0 font-heading text-xs font-semibold text-slate-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800 group-hover:text-brand-700">{k.nama}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500" title={`${persen(k.jumlah_jabatan, totalJabatan)}% dari ${fmt(totalJabatan)} jabatan`}>
                    {fmt(k.jumlah_jabatan)} jabatan
                  </span>
                </div>
                <div className="ml-6 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full origin-left animate-[tumbuh_0.8s_ease-out_both] rounded-full bg-brand-600" style={{ width: `${(k.jumlah_jabatan / max) * 100}%` }} />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </KartuInsight>
  );
}

function SebaranLevel({ level }: { level: number[] }) {
  const total = jumlah(level);
  const max = Math.max(1, ...level);
  // dua level bersebelahan dengan porsi terbesar, untuk kalimat kesimpulan
  const pasangan = level.slice(0, 4).map((c, i) => ({ i, n: c + level[i + 1] })).sort((a, b) => b.n - a.n)[0];
  return (
    <KartuInsight judul="Sebaran level target">
      <div className="flex h-28 items-end gap-2" role="img" aria-label={level.map((c, i) => `Level ${i + 1}: ${c}`).join(", ")}>
        {level.map((c, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] tabular-nums text-slate-500">{persen(c, total)}%</span>
            <div
              className={`lv${i + 1} w-full origin-bottom animate-[naik_0.6s_ease-out_both] rounded-t-md`}
              style={{ height: `${Math.max(4, (c / max) * 100)}%`, animationDelay: `${i * 70}ms` }}
              title={`${fmt(c)} pemetaan`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-2 text-center text-[11px] text-slate-500">
        {LEVEL_NAMA.map((n, i) => (
          <span key={n} className="truncate" title={n}>
            {i + 1} · {n}
          </span>
        ))}
      </div>
      {total > 0 && pasangan && (
        <p className="mt-3 text-[13px] text-slate-600">
          Level {pasangan.i + 1}–{pasangan.i + 2} ({LEVEL_NAMA[pasangan.i]}–{LEVEL_NAMA[pasangan.i + 1]}) mencakup{" "}
          <b className="text-slate-900">{persen(pasangan.n, total)}%</b> dari {fmt(total)} pemetaan.
        </p>
      )}
    </KartuInsight>
  );
}

function PerluPerhatian({ s, fokus, onFokus }: { s: Statistik; fokus: Fokus; onFokus: (f: Fokus) => void }) {
  const baris: { f: Fokus; n: number; label: string; hint: string }[] = [
    { f: "belum_dipetakan", n: s.belum, label: "Belum dipetakan", hint: "kompetensi teknis lengkap yang belum jadi target jabatan" },
    { f: "perlu", n: s.perlu, label: "Perlu dilengkapi", hint: "berstatus draft, usulan, atau belum disusun" },
  ];
  return (
    <KartuInsight judul="Perlu perhatian">
      <div className="space-y-2">
        {baris.map((b) => {
          const on = fokus === b.f;
          return (
            <button
              key={b.f}
              type="button"
              aria-pressed={on}
              onClick={() => onFokus(b.f)}
              className={`flex w-full items-center gap-3 rounded-lg p-3 text-left ring-1 transition ${
                on ? "bg-brand-50 ring-brand-500" : b.n ? "bg-amber-50/60 ring-amber-200 hover:ring-amber-400" : "bg-slate-50 ring-slate-200 hover:ring-slate-300"
              }`}
            >
              <span className={`font-heading text-2xl font-semibold tabular-nums ${on ? "text-brand-700" : b.n ? "text-amber-700" : "text-slate-400"}`}>{b.n}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{b.label}</span>
                <span className="block text-xs text-slate-600">{b.hint}</span>
              </span>
              <span className="text-xs font-medium text-brand-700">{on ? "Aktif" : "Lihat"}</span>
            </button>
          );
        })}
      </div>
      {s.bidangSepi && s.bidangSepi.dipakai < s.bidangSepi.bisa && (
        <p className="mt-3 text-[13px] text-slate-600">
          Bidang dengan porsi tak terpakai terbesar: <b className="text-slate-900">{s.bidangSepi.nama}</b> ({s.bidangSepi.bisa - s.bidangSepi.dipakai} dari{" "}
          {s.bidangSepi.bisa} kompetensi belum dipakai).
        </p>
      )}
    </KartuInsight>
  );
}

function KartuBidang({ b, n, on, onClick }: { b: StatBidang; n: number; on: boolean; onClick: () => void }) {
  const p = persen(b.dipakai, b.bisa);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      title={`${b.nama}: ${b.dipakai} dari ${b.bisa} kompetensi dipakai jabatan${b.rata ? `, rata-rata level ${satuDesimal(b.rata)}` : ""}`}
      className={`group flex flex-col rounded-lg p-2.5 text-left ring-1 transition ${
        on ? "bg-brand-700 text-white ring-brand-700" : n === 0 ? "bg-white text-slate-400 ring-slate-200 hover:ring-slate-300" : "bg-white ring-slate-200 hover:ring-brand-300"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-mono text-[11px] font-semibold ${on ? "text-brand-100" : "text-slate-500"}`}>{b.kode}</span>
        <span className={`text-[11px] tabular-nums ${on ? "text-brand-100" : "text-slate-500"}`}>{n}</span>
      </div>
      <div className={`mt-0.5 line-clamp-2 min-h-[2lh] text-[13px] font-medium leading-snug ${on ? "text-white" : n === 0 ? "" : "text-slate-800"}`}>{b.nama}</div>
      <div className={`mt-2 h-1 overflow-hidden rounded-full ${on ? "bg-white/20" : "bg-slate-100"}`}>
        <div className={`h-full rounded-full ${on ? "bg-amber-300" : p === 100 ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${p}%` }} />
      </div>
      <div className={`mt-1 flex justify-between text-[11px] tabular-nums ${on ? "text-brand-100" : "text-slate-500"}`}>
        <span>{p}% dipakai</span>
        {b.rata !== null && <span>Lv {satuDesimal(b.rata)}</span>}
      </div>
    </button>
  );
}

function BarisKompetensi({ k, term, maxJabatan, totalJabatan }: { k: Item; term: string; maxJabatan: number; totalJabatan: number }) {
  const rata = rataLevel(k.level);
  return (
    <li>
      <Link href={`/kompetensi/${k.kode}`} className="group flex gap-4 px-4 py-3 hover:bg-slate-50">
        <span className="w-16 shrink-0 pt-0.5 font-mono text-xs text-slate-500">
          <Sorot text={k.kode} term={term} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900 group-hover:text-brand-700">
              <Sorot text={k.nama} term={term} />
            </span>
            <Penanda k={k} />
          </div>
          {k.definisi && (
            <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
              <Sorot text={k.definisi} term={term} />
            </p>
          )}
        </div>
        <div className="hidden w-44 shrink-0 flex-col gap-1.5 pt-0.5 text-xs tabular-nums text-slate-500 sm:flex">
          {k.jumlah_jabatan ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span title={`${persen(k.jumlah_jabatan, totalJabatan)}% dari ${fmt(totalJabatan)} jabatan`}>{fmt(k.jumlah_jabatan)} jabatan</span>
                {rata !== null && <span className="text-slate-400">Lv {satuDesimal(rata)}</span>}
              </div>
              {k.kategori === "teknis" ? (
                <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${(k.jumlah_jabatan / maxJabatan) * 100}%` }} />
                </div>
              ) : null}
              <MiniLevel level={k.level} />
            </>
          ) : (
            <span className="text-amber-700">belum dipetakan</span>
          )}
          <span>{k.jumlah_indikator} indikator</span>
        </div>
      </Link>
    </li>
  );
}

function KartuKompetensi({ k, term }: { k: Item; term: string }) {
  const rata = rataLevel(k.level);
  return (
    <li>
      <Link
        href={`/kompetensi/${k.kode}`}
        className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-brand-800">
            <Sorot text={k.kode} term={term} />
          </span>
          <Penanda k={k} />
        </div>
        <h3 className="mt-2 font-heading text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-brand-700">
          <Sorot text={k.nama} term={term} />
        </h3>
        {k.definisi && (
          <p className="mt-1 line-clamp-3 text-sm text-slate-500">
            <Sorot text={k.definisi} term={term} />
          </p>
        )}
        <div className="min-h-3 flex-1" />
        {k.jumlah_jabatan > 0 && <MiniLevel level={k.level} className="mb-2" />}
        <div className="flex items-center gap-3 border-t border-slate-100 pt-3 text-xs tabular-nums text-slate-500">
          <span>{k.jumlah_indikator} indikator</span>
          {rata !== null && <span>Lv {satuDesimal(rata)}</span>}
          <span className={`ml-auto ${k.jumlah_jabatan ? "" : "text-amber-700"}`}>{k.jumlah_jabatan ? `${fmt(k.jumlah_jabatan)} jabatan` : "belum dipetakan"}</span>
        </div>
      </Link>
    </li>
  );
}

/** Batang bertumpuk sebaran level target, warna sama dengan sel Matriks. */
function MiniLevel({ level, className = "" }: { level: number[]; className?: string }) {
  const total = jumlah(level);
  if (!total) return null;
  return (
    <span
      className={`flex h-2 gap-px overflow-hidden rounded-full ${className}`}
      role="img"
      aria-label={`Sebaran level target: ${level.map((c, i) => `level ${i + 1} ${c}`).join(", ")}`}
    >
      {level.map((c, i) => c > 0 && <span key={i} className={`lv${i + 1} block`} style={{ width: `${(c / total) * 100}%` }} title={`Level ${i + 1} (${LEVEL_NAMA[i]}): ${c} jabatan`} />)}
    </span>
  );
}

function Penanda({ k }: { k: Item }) {
  return (
    <>
      {k.status !== "lengkap" && <StatusBadge status={k.status} />}
      {k.tanda_c && <Tag title='Bertanda "(C)" pada dokumen sumber'>(C)</Tag>}
      {k.catatan.length > 0 && <Tag title={k.catatan.join("\n")}>catatan</Tag>}
    </>
  );
}

/** Menandai potongan teks yang cocok dengan kata pencarian. */
function Sorot({ text, term }: { text: string; term: string }) {
  if (!term) return text;
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, from)) {
    if (at > from) out.push(text.slice(from, at));
    out.push(
      <mark key={at} className="rounded-sm bg-amber-200/70 text-inherit">
        {text.slice(at, at + term.length)}
      </mark>,
    );
    from = at + term.length;
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
}

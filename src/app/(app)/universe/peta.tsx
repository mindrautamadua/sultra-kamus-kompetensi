"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { JENJANG_LABEL, KATEGORI_LABEL, LEVEL_NAMA, STATUS_LABEL } from "@/lib/labels";
import type { UniverseData } from "@/lib/universe";

// Graf force-directed dua pohon (kamus & organisasi). Hanya cabang yang dibuka yang tampil (cascading);
// node terpilih memunculkan pasangan pemetaannya dari pohon lain sebagai "satelit".

type Jenis = "root" | "kategori" | "bidang" | "kompetensi" | "unit" | "jabatan" | "grup";
type Pohon = "kamus" | "org";
type Simpul = {
  id: string;
  jenis: Jenis;
  pohon: Pohon;
  label: string;
  sub?: string;
  parent: string | null;
  anak: string[];
  kedalaman: number;
  kode?: string;
  kategori?: string;
  status?: string;
  dbId?: number;
  jenjang?: number;
  pakai?: number; // kompetensi: jumlah jabatan pemakai
  // agregat node struktural
  jumlahKom?: number;
  yatim?: number; // kompetensi tanpa jabatan
  jumlahJab?: number;
  tanpaPemetaan?: number; // jabatan (selain Direksi) tanpa kompetensi
  anggota?: [number, number][]; // grup satelit: [jabatan_id, level]
};
// lemah: garis silang ke node yang sudah berada di pohon, ditarik pelan agar tata letak pohon tidak rusak
type Garis = { s: string; t: string; jenis: "pohon" | "silang" | "grup"; level?: number; jumlah?: number; lemah?: boolean };
type N = SimulationNodeDatum & { id: string };
type L = SimulationLinkDatum<N> & Garis;

// sama dengan PDF matriks/profil
const KATEGORI_WARNA: Record<string, string> = { inti: "#1f37b4", kepemimpinan: "#fbbf24", teknis: "#38bdf8" };
// rampa brand yang sama dengan kelas .lv1–.lv5
const LEVEL_WARNA = ["#bfd0fd", "#93b0fb", "#6087f6", "#2747d9", "#1d2d73"];
const URUT_KATEGORI = ["inti", "kepemimpinan", "teknis"];
const BATAS_SATELIT = 36; // lebih dari ini, satelit jabatan dikelompokkan per divisi/kantor
const JENIS_LABEL: Record<Jenis, string> = {
  root: "Akar",
  kategori: "Kategori",
  bidang: "Bidang kompetensi",
  kompetensi: "Kompetensi",
  unit: "Unit kerja",
  jabatan: "Jabatan",
  grup: "Kelompok jabatan",
};

const potong = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function bangun(d: UniverseData) {
  const peta = new Map<string, Simpul>();
  const tambah = (s: Omit<Simpul, "anak" | "kedalaman">) => {
    const simpul: Simpul = { ...s, anak: [], kedalaman: 0 };
    peta.set(s.id, simpul);
    return simpul;
  };

  tambah({ id: "root:kamus", jenis: "root", pohon: "kamus", label: "Kamus Kompetensi", parent: null });
  const kategoriAda = URUT_KATEGORI.filter((k) => d.bidang.some((b) => b.kategori === k));
  for (const k of kategoriAda) tambah({ id: `kat:${k}`, jenis: "kategori", pohon: "kamus", label: KATEGORI_LABEL[k] ?? k, kategori: k, parent: "root:kamus" });
  for (const b of d.bidang)
    tambah({ id: `bid:${b.kode}`, jenis: "bidang", pohon: "kamus", label: b.nama, kode: b.kode, kategori: b.kategori, parent: `kat:${b.kategori}` });
  for (const k of d.kompetensi)
    tambah({
      id: `kom:${k.id}`,
      jenis: "kompetensi",
      pohon: "kamus",
      label: k.nama,
      kode: k.kode,
      kategori: k.kategori,
      status: k.status,
      dbId: k.id,
      pakai: k.jabatan,
      parent: `bid:${k.bidang}`,
    });

  tambah({ id: "root:org", jenis: "root", pohon: "org", label: "Struktur Organisasi", parent: null });
  for (const u of d.unit)
    tambah({ id: `unit:${u.id}`, jenis: "unit", pohon: "org", label: u.nama, kode: u.kode, sub: u.jenis, dbId: u.id, parent: u.parent ? `unit:${u.parent}` : "root:org" });
  for (const j of d.jabatan)
    tambah({ id: `jab:${j.id}`, jenis: "jabatan", pohon: "org", label: j.nama, kode: j.kode, dbId: j.id, jenjang: j.jenjang, parent: `unit:${j.unit}` });

  // jabatan didahulukan dari sub-unit agar urutan cabang mengikuti dokumen struktur
  for (const s of peta.values()) if (s.parent && s.jenis === "jabatan") peta.get(s.parent)?.anak.push(s.id);
  for (const s of peta.values()) if (s.parent && s.jenis !== "jabatan") peta.get(s.parent)?.anak.push(s.id);

  const perKom = new Map<number, [number, number][]>();
  const perJab = new Map<number, [number, number][]>();
  for (const [j, k, lv] of d.relasi) {
    (perKom.get(k) ?? perKom.set(k, []).get(k)!).push([j, lv]);
    (perJab.get(j) ?? perJab.set(j, []).get(j)!).push([k, lv]);
  }

  // kedalaman & agregat (post-order)
  const isi = (id: string, dalam: number) => {
    const s = peta.get(id)!;
    s.kedalaman = dalam;
    if (s.jenis === "kompetensi") {
      s.jumlahKom = 1;
      s.yatim = s.pakai ? 0 : 1;
    } else if (s.jenis === "jabatan") {
      s.jumlahJab = 1;
      s.tanpaPemetaan = s.jenjang && !perJab.has(s.dbId!) ? 1 : 0;
    }
    for (const c of s.anak) {
      const a = isi(c, dalam + 1);
      for (const key of ["jumlahKom", "yatim", "jumlahJab", "tanpaPemetaan"] as const) if (a[key] !== undefined) s[key] = (s[key] ?? 0) + a[key]!;
    }
    return s;
  };
  isi("root:kamus", 0);
  isi("root:org", 0);
  for (const s of peta.values()) if (s.jenis === "unit" || s.jenis === "bidang") s.sub = `${s.jumlahJab ?? s.jumlahKom ?? 0} ${s.jenis === "unit" ? "jabatan" : "kompetensi"}`;

  return { peta, perKom, perJab };
}

const leluhur = (peta: Map<string, Simpul>, id: string) => {
  const out: Simpul[] = [];
  for (let p = peta.get(id)?.parent; p; p = peta.get(p)?.parent ?? null) out.unshift(peta.get(p)!);
  return out;
};

// divisi/kantor (unit di bawah unit teratas) sebagai kunci kelompok satelit jabatan
function unitInduk(peta: Map<string, Simpul>, jabId: number) {
  let s = peta.get(peta.get(`jab:${jabId}`)!.parent!)!;
  while (s.kedalaman > 2 && s.parent) s = peta.get(s.parent)!;
  return s;
}

function radius(s: Simpul) {
  switch (s.jenis) {
    case "root":
      return 24;
    case "kategori":
      return 17;
    case "bidang":
      return 11;
    case "unit":
      return s.kedalaman <= 2 ? 11 : 8;
    case "kompetensi":
      return Math.min(13, 4 + Math.sqrt(s.pakai ?? 0) * 0.9);
    case "jabatan":
      return 5.5;
    case "grup":
      return Math.min(16, 6 + Math.sqrt(s.anggota?.length ?? 0) * 1.4);
  }
}

function warna(s: Simpul) {
  if (s.kategori) return KATEGORI_WARNA[s.kategori];
  if (s.jenis === "root") return "#121a42";
  if (s.jenis === "unit") return "#1e3192";
  if (s.jenis === "grup") return "#475569";
  return "#64748b";
}

export function Peta({ data }: { data: UniverseData }) {
  const { peta, perKom, perJab } = useMemo(() => bangun(data), [data]);
  const atasNama = useMemo(() => new Map(data.unit.map((u) => [u.id, u.nama])), [data.unit]);

  const [mode, setMode] = useState<Pohon>("kamus");
  const [terbuka, setTerbuka] = useState<Set<string>>(() => {
    const awal = new Set(["root:kamus", "root:org"]);
    // unit teratas (Direksi) langsung dibuka supaya pohon organisasi tidak cuma satu node
    for (const c of peta.get("root:org")?.anak ?? []) awal.add(c);
    return awal;
  });
  const [pilih, setPilih] = useState<string | null>(null);
  const [grupTerbuka, setGrupTerbuka] = useState<Set<string>>(new Set());
  const [sorot, setSorot] = useState<string | null>(null);

  // ----- himpunan node & garis yang tampil -----
  const tampil = useMemo(() => {
    const ids = new Set<string>();
    const garis: Garis[] = [];
    const ekstra = new Map<string, Simpul>();
    const jalan = (id: string) => {
      ids.add(id);
      if (!terbuka.has(id)) return;
      for (const c of peta.get(id)!.anak) {
        garis.push({ s: id, t: c, jenis: "pohon" });
        jalan(c);
      }
    };
    jalan(mode === "kamus" ? "root:kamus" : "root:org");

    const terkait = new Set<string>();
    const sp = pilih ? peta.get(pilih) : null;
    if (sp && (sp.jenis === "kompetensi" || sp.jenis === "jabatan")) {
      ids.add(sp.id);
      terkait.add(sp.id);
      for (const a of leluhur(peta, sp.id)) if (ids.has(a.id)) terkait.add(a.id);
      const silang =
        sp.jenis === "kompetensi"
          ? (perKom.get(sp.dbId!) ?? []).map(([j, lv]) => [`jab:${j}`, lv, j] as const)
          : (perJab.get(sp.dbId!) ?? []).map(([k, lv]) => [`kom:${k}`, lv, k] as const);
      // yang sudah tampil di pohon cukup diberi garis; sisanya satelit, dikelompokkan bila terlalu banyak
      const sisa = silang.filter(([id]) => !ids.has(id));
      for (const [id, lv] of silang)
        if (ids.has(id)) {
          garis.push({ s: sp.id, t: id, jenis: "silang", level: lv, lemah: true });
          terkait.add(id);
        }
      if (sp.jenis === "kompetensi" && sisa.length > BATAS_SATELIT) {
        const kelompok = new Map<string, Simpul>();
        for (const [, lv, j] of sisa) {
          const induk = unitInduk(peta, j);
          // divisi yang sudah tampil di pohon organisasi dipakai langsung sebagai kelompoknya
          const gid = ids.has(induk.id) ? induk.id : `grup:${induk.id}`;
          let g = kelompok.get(gid);
          if (!g) {
            g = { id: gid, jenis: "grup", pohon: "org", label: induk.label, parent: null, anak: [], kedalaman: 0, anggota: [] };
            kelompok.set(gid, g);
          }
          g.anggota!.push([j, lv]);
        }
        for (const g of kelompok.values()) {
          g.sub = `${g.anggota!.length} jabatan`;
          terkait.add(g.id);
          if (ids.has(g.id)) {
            garis.push({ s: sp.id, t: g.id, jenis: "grup", jumlah: g.anggota!.length, lemah: true });
            continue;
          }
          ekstra.set(g.id, g);
          ids.add(g.id);
          garis.push({ s: sp.id, t: g.id, jenis: "grup", jumlah: g.anggota!.length });
          if (grupTerbuka.has(g.id))
            for (const [j, lv] of g.anggota!) {
              ids.add(`jab:${j}`);
              terkait.add(`jab:${j}`);
              garis.push({ s: g.id, t: `jab:${j}`, jenis: "silang", level: lv });
            }
        }
      } else
        for (const [id, lv] of sisa) {
          ids.add(id);
          terkait.add(id);
          garis.push({ s: sp.id, t: id, jenis: "silang", level: lv });
        }
    }
    return { ids: [...ids], garis, ekstra, terkait };
  }, [peta, perKom, perJab, mode, terbuka, pilih, grupTerbuka]);

  const ambil = useCallback((id: string) => peta.get(id) ?? tampil.ekstra.get(id), [peta, tampil.ekstra]);

  // ----- simulasi -----
  const simRef = useRef<Simulation<N, L> | null>(null);
  const objRef = useRef(new Map<string, N>());
  const linkRef = useRef<L[]>([]);
  const baruRef = useRef(new Set<string>());
  const [view, setView] = useState({ x: 0, y: 0, k: 0.9 });
  // salinan posisi untuk render: ref simulasi tidak boleh dibaca saat render
  const [gambar, setGambar] = useState<{ pos: Map<string, { x: number; y: number }>; links: L[]; baru: Set<string> }>({
    pos: new Map(),
    links: [],
    baru: new Set(),
  });
  // kamera: selama ikuti aktif, view digeser pelan ke node fokus (terpilih + pasangannya, atau semua node).
  // Dimatikan begitu pengguna menggeser/zoom sendiri, dihidupkan lagi oleh klik node atau tombol Sesuaikan.
  const ikutiRef = useRef(true);
  const fokusRef = useRef<string[]>([]);
  const ukuranRef = useRef({ w: 800, h: 600 });
  const gambarUlang = useCallback((langsung?: boolean) => {
    const pos = new Map<string, { x: number; y: number }>();
    for (const [id, o] of objRef.current) pos.set(id, { x: o.x ?? 0, y: o.y ?? 0 });
    setGambar({ pos, links: linkRef.current, baru: baruRef.current });
    if (!ikutiRef.current) return;
    const ns = fokusRef.current.map((id) => pos.get(id)).filter((n) => n !== undefined);
    if (!ns.length) return;
    const xs = ns.map((n) => n.x);
    const ys = ns.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const { w, h } = ukuranRef.current;
    const k = Math.min(1.6, Math.max(0.2, Math.min(w / (x1 - x0 + 220), h / (y1 - y0 + 160))));
    const tuju = { k, x: (-(x0 + x1) / 2) * k, y: (-(y0 + y1) / 2) * k };
    const f = langsung === true ? 1 : 0.12;
    setView((v) => ({ k: v.k + (tuju.k - v.k) * f, x: v.x + (tuju.x - v.x) * f, y: v.y + (tuju.y - v.y) * f }));
  }, []);

  useEffect(() => {
    const sim = forceSimulation<N, L>()
      .alphaDecay(0.035)
      .velocityDecay(0.35)
      .force("x", forceX<N>(0).strength(0.03))
      .force("y", forceY<N>(0).strength(0.03))
      .on("tick", () => gambarUlang());
    sim.stop();
    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [gambarUlang]);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    const lama = objRef.current;
    const baru = new Map<string, N>();
    const muncul = new Set<string>();
    const asal = (s: Simpul): N | undefined => {
      const dariGaris = tampil.garis.find((g) => g.t === s.id && (lama.has(g.s) || baru.has(g.s)));
      return dariGaris ? (baru.get(dariGaris.s) ?? lama.get(dariGaris.s)) : undefined;
    };
    for (const id of tampil.ids) {
      const s = ambil(id)!;
      let o = lama.get(id);
      if (!o) {
        const p = asal(s);
        const sudut = Math.random() * Math.PI * 2;
        o = { id, x: (p?.x ?? 0) + Math.cos(sudut) * 6, y: (p?.y ?? 0) + Math.sin(sudut) * 6 };
        muncul.add(id);
      }
      // akar pohon aktif dipaku di tengah
      if (s.jenis === "root") {
        o.fx = 0;
        o.fy = 0;
      }
      baru.set(id, o);
    }
    objRef.current = baru;
    baruRef.current = muncul;
    fokusRef.current = tampil.terkait.size ? [...tampil.terkait] : tampil.ids;
    ikutiRef.current = true;
    const links: L[] = tampil.garis.map((g) => ({ ...g, source: g.s, target: g.t }));
    linkRef.current = links;

    // force lama dilepas dulu: sim.nodes() menginisialisasi ulang force dengan aksesor lama yang tidak mengenal node baru
    sim.force("link", null).force("charge", null).force("collide", null);
    sim.nodes([...baru.values()]);
    sim.force(
      "link",
      forceLink<N, L>(links)
        .id((n) => n.id)
        .distance((l) => {
          if (l.jenis !== "pohon") return l.jenis === "grup" ? 150 : 110;
          const t = ambil(l.t)!;
          return { root: 0, kategori: 130, bidang: 120, kompetensi: 36, unit: t.kedalaman <= 2 ? 130 : 70, jabatan: 36, grup: 0 }[t.jenis];
        })
        .strength((l) => (l.jenis === "pohon" ? 0.9 : l.lemah ? 0.04 : 0.25)),
    );
    sim.force(
      "charge",
      forceManyBody<N>()
        .strength((n) => ({ root: -800, kategori: -500, bidang: -380, unit: -340, grup: -260, kompetensi: -60, jabatan: -60 })[ambil(n.id)!.jenis])
        .distanceMax(650),
    );
    // node berlabel tetap diberi ruang lebih supaya labelnya tidak saling tumpuk
    sim.force(
      "collide",
      forceCollide<N>((n) => {
        const s = ambil(n.id)!;
        return radius(s) + (s.jenis === "bidang" || s.jenis === "grup" || (s.jenis === "unit" && s.kedalaman <= 2) ? 22 : 3);
      }),
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sim.alpha(1).tick(250);
      requestAnimationFrame(() => gambarUlang(true));
    } else sim.alpha(0.9).restart();
  }, [tampil, ambil, gambarUlang]);

  // ----- pan & zoom -----
  const svgRef = useRef<SVGSVGElement>(null);
  const [ukuran, setUkuran] = useState({ w: 800, h: 600 });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const el = svgRef.current!;
    const ro = new ResizeObserver(([e]) => {
      ukuranRef.current = { w: e.contentRect.width, h: e.contentRect.height };
      setUkuran(ukuranRef.current);
    });
    ro.observe(el);
    // wheel harus non-passive agar halaman tidak ikut tergulir
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      ikutiRef.current = false;
      const r = el.getBoundingClientRect();
      const v = viewRef.current;
      const k = Math.min(4, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0015)));
      const cx = e.clientX - r.left - r.width / 2;
      const cy = e.clientY - r.top - r.height / 2;
      setView({ k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k });
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", roda);
    };
  }, []);

  const geser = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [menggeser, setMenggeser] = useState(false);
  const zoom = (f: number) => {
    ikutiRef.current = false;
    setView((v) => ({ k: Math.min(4, Math.max(0.2, v.k * f)), x: v.x * f, y: v.y * f }));
  };
  const sesuaikan = () => {
    fokusRef.current = [...objRef.current.keys()];
    ikutiRef.current = true;
    gambarUlang(true);
  };

  // ----- interaksi -----
  const fokus = (id: string) => {
    const s = peta.get(id);
    if (!s) return;
    setMode(s.pohon);
    setTerbuka((t) => {
      const n = new Set(t);
      for (const a of leluhur(peta, id)) n.add(a.id);
      if (s.anak.length) n.add(id);
      return n;
    });
    setPilihBaru(id);
  };
  const setPilihBaru = useCallback((id: string | null) => {
    setPilih(id);
    setGrupTerbuka(new Set());
  }, []);
  const klik = (id: string) => {
    const s = ambil(id)!;
    if (s.jenis === "grup") {
      setGrupTerbuka((g) => {
        const n = new Set(g);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      return;
    }
    if (s.anak.length && s.jenis !== "root") {
      setTerbuka((t) => {
        const n = new Set(t);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
    }
    if (s.jenis === "root") setPilihBaru(null);
    else setPilihBaru(id);
  };
  const gantiMode = (m: Pohon) => setMode(m);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPilihBaru(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [setPilihBaru]);

  // ----- render -----
  const sp = pilih ? ambil(pilih) : null;
  const redup = !!sp && (sp.jenis === "kompetensi" || sp.jenis === "jabatan");
  const jumlahDaun = tampil.ids.filter((id) => id.startsWith("kom:") || id.startsWith("jab:")).length;
  const labelDaun = jumlahDaun <= 45 || view.k >= 1.6;
  const objs = gambar.pos;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="relative h-[calc(100dvh-220px)] min-h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_center,var(--color-brand-50),white_70%)] shadow-sm">
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-lg bg-white/90 p-1 text-sm shadow-sm ring-1 ring-slate-200 backdrop-blur">
          <span className="px-2 text-xs font-medium text-slate-500">Mulai dari</span>
          {(
            [
              ["kamus", "Kamus"],
              ["org", "Struktur organisasi"],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              type="button"
              onClick={() => gantiMode(m)}
              aria-pressed={mode === m}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${mode === m ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 rounded-lg bg-white/90 p-1 shadow-sm ring-1 ring-slate-200 backdrop-blur">
          <TombolIkon label="Perbesar" onClick={() => zoom(1.25)} d="M10 5v10M5 10h10" />
          <TombolIkon label="Perkecil" onClick={() => zoom(0.8)} d="M5 10h10" />
          <TombolIkon label="Sesuaikan ke layar" onClick={sesuaikan} d="M4 8V4h4M12 4h4v4M16 12v4h-4M8 16H4v-4" />
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 z-10 hidden text-xs text-slate-500 sm:block">
          Gulir untuk zoom · seret latar untuk menggeser · Esc untuk batal pilih
        </p>

        <svg ref={svgRef} className="size-full touch-none select-none" role="group" aria-label="Graf universe kompetensi">
          <rect
            width="100%"
            height="100%"
            fill="transparent"
            className={menggeser ? "cursor-grabbing" : "cursor-grab"}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              geser.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
              ikutiRef.current = false;
              setMenggeser(true);
            }}
            onPointerMove={(e) => {
              const g = geser.current;
              if (g) setView((v) => ({ ...v, x: g.vx + e.clientX - g.x, y: g.vy + e.clientY - g.y }));
            }}
            onPointerUp={(e) => {
              const g = geser.current;
              geser.current = null;
              setMenggeser(false);
              // klik latar tanpa menggeser = batal pilih
              if (g && Math.abs(e.clientX - g.x) + Math.abs(e.clientY - g.y) < 4) setPilihBaru(null);
            }}
          />
          <g transform={`translate(${ukuran.w / 2 + view.x},${ukuran.h / 2 + view.y}) scale(${view.k})`}>
            {gambar.links.map((l) => {
              const a = objs.get(l.s);
              const b = objs.get(l.t);
              if (!a || !b) return null;
              const aktif = !redup || (tampil.terkait.has(l.s) && tampil.terkait.has(l.t));
              const stroke = l.jenis === "pohon" ? "#cbd5e1" : l.jenis === "grup" ? "#94a3b8" : LEVEL_WARNA[(l.level ?? 1) - 1];
              const tebal = l.jenis === "pohon" ? 1 : l.jenis === "grup" ? Math.min(6, 1 + Math.sqrt(l.jumlah ?? 1)) : 1.6;
              return (
                <line
                  key={`${l.s}>${l.t}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={stroke}
                  strokeWidth={tebal / Math.sqrt(view.k)}
                  strokeDasharray={l.jenis === "grup" ? "4 3" : undefined}
                  opacity={aktif ? (l.jenis === "pohon" ? 0.9 : 0.85) : 0.15}
                  className="transition-opacity duration-300"
                />
              );
            })}
            {tampil.ids.map((id) => {
              const o = objs.get(id);
              const s = ambil(id);
              if (!o || !s) return null;
              const r = radius(s);
              const w = warna(s);
              const dipilih = id === pilih;
              const aktif = !redup || tampil.terkait.has(id);
              const tertutup = s.anak.length > 0 && !terbuka.has(id) && s.jenis !== "root";
              const hollow = s.jenis === "kompetensi" && !s.pakai;
              const struktural = s.jenis === "root" || s.jenis === "kategori" || s.jenis === "bidang" || (s.jenis === "unit" && s.kedalaman <= 2);
              const tampilLabel = s.jenis === "grup" ? sorot === id || view.k >= 1.2 : struktural || dipilih || sorot === id || (labelDaun && aktif) || (redup && aktif && s.jenis !== "unit");
              const level = redup ? tampil.garis.find((g) => g.jenis === "silang" && g.t === id)?.level : undefined;
              const bentuk = s.jenis === "unit" || s.jenis === "jabatan" || s.jenis === "grup";
              return (
                <g
                  key={id}
                  transform={`translate(${o.x},${o.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${JENIS_LABEL[s.jenis]}: ${s.label}${tertutup ? " (tertutup, tekan Enter untuk membuka)" : ""}`}
                  aria-pressed={dipilih}
                  onClick={() => klik(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      klik(id);
                    }
                  }}
                  onMouseEnter={() => setSorot(id)}
                  onMouseLeave={() => setSorot((x) => (x === id ? null : x))}
                  onFocus={() => setSorot(id)}
                  onBlur={() => setSorot((x) => (x === id ? null : x))}
                  opacity={aktif ? 1 : 0.25}
                  className="cursor-pointer outline-none transition-opacity duration-300"
                >
                  <g className={gambar.baru.has(id) ? "simpul-mekar" : undefined}>
                    {(dipilih || sorot === id) && <circle r={r + 7} fill="none" stroke="#f59e0b" strokeWidth={dipilih ? 2.5 : 1.5} opacity={dipilih ? 0.9 : 0.6} />}
                    {tertutup && <circle r={r + 3.5} fill="none" stroke={w} strokeWidth={1} strokeDasharray="2 2" opacity={0.7} />}
                    {bentuk ? (
                      <rect
                        className="inti"
                        x={-r}
                        y={-r}
                        width={r * 2}
                        height={r * 2}
                        rx={s.jenis === "jabatan" ? 1.5 : r * 0.35}
                        fill={s.jenis === "grup" ? "#f1f5f9" : w}
                        stroke={s.jenis === "grup" ? w : "white"}
                        strokeWidth={s.jenis === "grup" ? 1.5 : 1}
                        strokeDasharray={s.jenis === "grup" ? "3 2" : undefined}
                      />
                    ) : (
                      <circle
                        className="inti"
                        r={r}
                        fill={hollow ? "white" : w}
                        stroke={hollow ? w : "white"}
                        strokeWidth={hollow ? 2 : 1.2}
                        strokeDasharray={s.status && s.status !== "lengkap" ? "2.5 1.5" : undefined}
                      />
                    )}
                    {s.jenis === "grup" && (
                      <text y={3} textAnchor="middle" fontSize={8} fontWeight={700} fill="#334155" pointerEvents="none">
                        {s.anggota!.length}
                      </text>
                    )}
                    {level !== undefined && (
                      <text y={3} textAnchor="middle" fontSize={7.5} fontWeight={700} fill={s.jenis === "kompetensi" && s.kategori === "inti" ? "white" : "#0f172a"} pointerEvents="none">
                        {level}
                      </text>
                    )}
                  </g>
                  {tampilLabel && (
                    <text
                      y={r + 12}
                      textAnchor="middle"
                      fontSize={(struktural ? 11.5 : 10) / Math.sqrt(view.k)}
                      fontWeight={struktural || dipilih ? 600 : 400}
                      fill="#0f172a"
                      stroke="white"
                      strokeWidth={3 / Math.sqrt(view.k)}
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      {potong(s.label, dipilih || sorot === id ? 60 : 30)}
                      {s.jenis === "grup" && ` · ${s.sub}`}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <Panel
        peta={peta}
        perKom={perKom}
        perJab={perJab}
        atasNama={atasNama}
        data={data}
        simpul={sp ?? null}
        mode={mode}
        onPilih={setPilihBaru}
        onFokus={fokus}
      />
    </div>
  );
}

function TombolIkon({ label, d, onClick }: { label: string; d: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-4" aria-hidden>
        <path d={d} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Panel({
  peta,
  perKom,
  perJab,
  atasNama,
  data,
  simpul,
  mode,
  onPilih,
  onFokus,
}: {
  peta: Map<string, Simpul>;
  perKom: Map<number, [number, number][]>;
  perJab: Map<number, [number, number][]>;
  atasNama: Map<number, string>;
  data: UniverseData;
  simpul: Simpul | null;
  mode: Pohon;
  onPilih: (id: string | null) => void;
  onFokus: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const hasil = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const out: Simpul[] = [];
    for (const s of peta.values()) {
      if (s.jenis === "root" || s.jenis === "kategori") continue;
      if (s.label.toLowerCase().includes(t) || s.kode?.toLowerCase().includes(t)) out.push(s);
      if (out.length >= 10) break;
    }
    return out;
  }, [q, peta]);

  const kamus = peta.get("root:kamus")!;
  const org = peta.get("root:org")!;

  return (
    <aside className="flex min-h-0 flex-col gap-3 lg:h-[calc(100dvh-220px)] lg:min-h-[520px]">
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari kompetensi, jabatan, unit…"
          aria-label="Cari node"
          className="field w-full"
        />
        {hasil.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
            {hasil.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onFokus(s.id);
                    setQ("");
                  }}
                  className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1 truncate text-slate-900">{s.label}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">{JENIS_LABEL[s.jenis]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {simpul ? (
          <Detail peta={peta} perKom={perKom} perJab={perJab} atasNama={atasNama} data={data} s={simpul} mode={mode} onPilih={onPilih} onFokus={onFokus} />
        ) : (
          <div className="space-y-4 text-sm text-slate-600">
            <p>
              Klik node untuk membuka cabangnya. Klik <b>kompetensi</b> untuk melihat jabatan yang membutuhkannya, atau <b>jabatan</b> untuk melihat kompetensinya;
              pasangannya muncul sebagai satelit dengan garis berwarna level target.
            </p>
            <dl className="grid grid-cols-2 gap-2">
              <Angka label="Kompetensi" nilai={kamus.jumlahKom ?? 0} />
              <Angka label="Belum dipakai jabatan" nilai={kamus.yatim ?? 0} aksen />
              <Angka label="Jabatan" nilai={org.jumlahJab ?? 0} />
              <Angka label="Jabatan tanpa pemetaan" nilai={org.tanpaPemetaan ?? 0} aksen />
            </dl>
          </div>
        )}
      </section>

      <Legenda />
    </aside>
  );
}

function Angka({ label, nilai, aksen }: { label: string; nilai: number; aksen?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${aksen && nilai > 0 ? "text-amber-700" : "text-slate-900"}`}>{nilai.toLocaleString("id-ID")}</dd>
    </div>
  );
}

function Detail({
  peta,
  perKom,
  perJab,
  atasNama,
  data,
  s,
  mode,
  onPilih,
  onFokus,
}: {
  peta: Map<string, Simpul>;
  perKom: Map<number, [number, number][]>;
  perJab: Map<number, [number, number][]>;
  atasNama: Map<number, string>;
  data: UniverseData;
  s: Simpul;
  mode: Pohon;
  onPilih: (id: string | null) => void;
  onFokus: (id: string) => void;
}) {
  const jalur = s.jenis === "grup" ? [] : leluhur(peta, s.id);
  const unitJab = useMemo(() => new Map(data.jabatan.map((j) => [j.id, j.unit])), [data.jabatan]);

  return (
    <div className="space-y-4 text-sm">
      <div>
        {jalur.length > 0 && (
          <nav aria-label="Jalur" className="mb-1.5 flex flex-wrap items-center gap-x-1 text-[11px] text-slate-500">
            {jalur.map((a, i) => (
              <span key={a.id} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>›</span>}
                <button type="button" onClick={() => onFokus(a.id)} className="hover:text-brand-700 hover:underline">
                  {potong(a.label, 28)}
                </button>
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-heading text-base leading-snug font-semibold text-slate-900">{s.label}</h2>
          <button type="button" onClick={() => onPilih(null)} aria-label="Tutup detail" className="-mt-1 -mr-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            ✕
          </button>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {JENIS_LABEL[s.jenis]}
          {s.kode && ` · ${s.kode}`}
          {s.status && ` · ${STATUS_LABEL[s.status] ?? s.status}`}
          {s.jenjang !== undefined && ` · ${JENJANG_LABEL[s.jenjang] ?? s.jenjang}`}
        </p>
        {s.pohon !== mode && s.jenis !== "grup" && (
          <button type="button" onClick={() => onFokus(s.id)} className="link mt-1.5 text-xs">
            Tampilkan di pohon {s.pohon === "kamus" ? "kamus" : "struktur organisasi"} →
          </button>
        )}
      </div>

      {s.jenis === "kompetensi" && <DetailKompetensi s={s} rows={perKom.get(s.dbId!) ?? []} peta={peta} unitJab={unitJab} atasNama={atasNama} onPilih={onPilih} />}
      {s.jenis === "jabatan" && <DetailJabatan s={s} rows={perJab.get(s.dbId!) ?? []} peta={peta} onPilih={onPilih} />}
      {s.jenis === "grup" && (
        <Daftar
          judul={`${s.anggota!.length} jabatan di ${s.label}`}
          items={[...s.anggota!].sort((a, b) => b[1] - a[1]).map(([j, lv]) => ({ id: `jab:${j}`, label: peta.get(`jab:${j}`)!.label, level: lv }))}
          onPilih={onPilih}
          catatan="Klik kelompok di graf untuk memekarkan jabatannya."
        />
      )}
      {(s.jenis === "kategori" || s.jenis === "bidang") && (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Angka label="Kompetensi" nilai={s.jumlahKom ?? 0} />
            <Angka label="Belum dipakai jabatan" nilai={s.yatim ?? 0} aksen />
          </dl>
          {(s.yatim ?? 0) > 0 && (
            <Daftar
              judul="Belum dipakai jabatan mana pun"
              items={turunan(peta, s.id, "kompetensi")
                .filter((k) => !k.pakai)
                .map((k) => ({ id: k.id, label: k.label, kode: k.kode }))}
              onPilih={onPilih}
            />
          )}
        </>
      )}
      {(s.jenis === "unit" || s.jenis === "root") && s.pohon === "org" && (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Angka label="Jabatan" nilai={s.jumlahJab ?? 0} />
            <Angka label="Tanpa pemetaan" nilai={s.tanpaPemetaan ?? 0} aksen />
          </dl>
          {(s.tanpaPemetaan ?? 0) > 0 && (
            <Daftar
              judul="Jabatan tanpa kompetensi"
              items={turunan(peta, s.id, "jabatan")
                .filter((j) => j.jenjang && !perJab.has(j.dbId!))
                .map((j) => ({ id: j.id, label: j.label }))}
              onPilih={onPilih}
            />
          )}
        </>
      )}
    </div>
  );
}

function turunan(peta: Map<string, Simpul>, id: string, jenis: Jenis): Simpul[] {
  const out: Simpul[] = [];
  const jalan = (i: string) => {
    const s = peta.get(i)!;
    if (s.jenis === jenis) out.push(s);
    for (const c of s.anak) jalan(c);
  };
  jalan(id);
  return out;
}

function DetailKompetensi({
  s,
  rows,
  peta,
  unitJab,
  atasNama,
  onPilih,
}: {
  s: Simpul;
  rows: [number, number][];
  peta: Map<string, Simpul>;
  unitJab: Map<number, number>;
  atasNama: Map<number, string>;
  onPilih: (id: string | null) => void;
}) {
  const perLevel = [1, 2, 3, 4, 5].map((lv) => rows.filter(([, l]) => l === lv).length);
  const maks = Math.max(1, ...perLevel);
  return (
    <>
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-semibold tracking-wide text-slate-700 uppercase">Dipakai {rows.length} jabatan</span>
          <Link href={`/kompetensi/${encodeURIComponent(s.kode!)}`} className="link text-xs">
            Buka kompetensi →
          </Link>
        </div>
        <div className="space-y-1">
          {perLevel.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`lv${i + 1} w-20 shrink-0 rounded px-1.5 py-0.5 text-center font-medium`}>
                {i + 1} · {LEVEL_NAMA[i]}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full" style={{ width: `${(n / maks) * 100}%`, background: LEVEL_WARNA[i] }} />
              </span>
              <span className="w-7 text-right tabular-nums text-slate-600">{n}</span>
            </div>
          ))}
        </div>
      </div>
      {rows.length > 0 && (
        <Daftar
          judul="Jabatan"
          items={[...rows]
            .sort((a, b) => b[1] - a[1])
            .map(([j, lv]) => ({ id: `jab:${j}`, label: peta.get(`jab:${j}`)!.label, sub: atasNama.get(unitJab.get(j)!), level: lv }))}
          onPilih={onPilih}
        />
      )}
    </>
  );
}

function DetailJabatan({ s, rows, peta, onPilih }: { s: Simpul; rows: [number, number][]; peta: Map<string, Simpul>; onPilih: (id: string | null) => void }) {
  const kom = rows.map(([k, lv]) => ({ s: peta.get(`kom:${k}`)!, lv }));
  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold tracking-wide text-slate-700 uppercase">{rows.length} kompetensi</span>
        <Link href={`/jabatan/${encodeURIComponent(s.kode!)}`} className="link text-xs">
          Buka jabatan →
        </Link>
      </div>
      {URUT_KATEGORI.map((k) => {
        const items = kom.filter((x) => x.s.kategori === k).sort((a, b) => b.lv - a.lv);
        return items.length ? (
          <Daftar
            key={k}
            judul={KATEGORI_LABEL[k]}
            warna={KATEGORI_WARNA[k]}
            items={items.map((x) => ({ id: x.s.id, label: x.s.label, kode: x.s.kode, level: x.lv }))}
            onPilih={onPilih}
          />
        ) : null;
      })}
    </>
  );
}

function Daftar({
  judul,
  warna,
  items,
  onPilih,
  catatan,
}: {
  judul: string;
  warna?: string;
  items: { id: string; label: string; sub?: string; kode?: string; level?: number }[];
  onPilih: (id: string | null) => void;
  catatan?: string;
}) {
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-700 uppercase">
        {warna && <span className="size-2 rounded-full" style={{ background: warna }} aria-hidden />}
        {judul}
      </h3>
      {catatan && <p className="mb-1.5 text-xs text-slate-500">{catatan}</p>}
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" onClick={() => onPilih(it.id)} className="flex w-full items-center gap-2 py-1.5 text-left hover:bg-slate-50">
              {it.level !== undefined && <span className={`lv${it.level} grid size-5 shrink-0 place-items-center rounded text-[11px] font-semibold`}>{it.level}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-slate-800">{it.label}</span>
                {(it.sub || it.kode) && <span className="block truncate text-[11px] text-slate-500">{it.sub ?? it.kode}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Legenda() {
  return (
    <details className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 shadow-sm">
      <summary className="cursor-pointer font-semibold text-slate-700">Legenda</summary>
      <ul className="mt-2 space-y-1.5">
        {URUT_KATEGORI.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: KATEGORI_WARNA[k] }} /> Kompetensi {KATEGORI_LABEL[k].toLowerCase()} (besar = dipakai banyak jabatan)
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full border-2" style={{ borderColor: KATEGORI_WARNA.teknis }} /> Belum dipakai jabatan mana pun
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full border border-dashed border-slate-500" /> Bergaris putus: cabang tertutup / status belum lengkap
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-[#1e3192]" /> Unit kerja · <span className="size-2.5 rounded-[2px] bg-slate-500" /> Jabatan
        </li>
        <li className="flex items-center gap-2">
          <span className="flex">
            {LEVEL_WARNA.map((c) => (
              <span key={c} className="h-1.5 w-3" style={{ background: c }} />
            ))}
          </span>
          Garis pemetaan: level target 1 → 5
        </li>
      </ul>
    </details>
  );
}

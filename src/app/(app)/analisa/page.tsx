import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Hitung } from "@/components/hitung";
import { Batang, Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { DashboardSkeleton } from "@/components/skeleton";
import { JENJANG_LABEL, LEVEL_NAMA, fmt } from "@/lib/labels";
import { must, supabase } from "@/lib/supabase";

export const metadata: Metadata = { title: "Analisa Data" };

// Initial suggestion of which competency fields are most relevant per org unit (not stored; compared with the actual mapping below).
const SARAN_BIDANG: [string, string[]][] = [
  ["Divisi Corporate Secretary", ["CGA", "GCL"]],
  ["Divisi Perencanaan", ["SPB"]],
  ["Satuan Kerja Audit Internal", ["IAD"]],
  ["Bagian Hukum & Litigasi", ["GCL"]],
  ["Divisi Kepatuhan, APU PPT & PPPSPM", ["GCL"]],
  ["Divisi Manajemen Risiko", ["RMG", "ITD"]],
  ["Divisi Keuangan & Akuntansi", ["FNM"]],
  ["Divisi Human Capital", ["HCM"]],
  ["Divisi Umum", ["CGA"]],
  ["Divisi Teknologi Informasi", ["ITD", "DBM"]],
  ["Bagian CISO & PDP", ["ITD"]],
  ["Divisi Operasional & Layanan", ["SBT", "DBM"]],
  ["Divisi Treasury", ["FTM"]],
  ["Divisi Pemasaran Dana & Jasa", ["FTM", "MPS", "DBM"]],
  ["Divisi Operasional Kredit", ["CSM"]],
  ["Divisi Kredit Menengah, Komersial, Korporasi & Hubungan Kelembagaan", ["CSM", "MPS"]],
  ["Divisi Kredit Konsumtif & Mikro", ["CSM", "MPS"]],
  ["Kantor Cabang / Capem / Fungsional", ["SBT", "CSM", "FTM", "MPS"]],
];
const JARINGAN = "Kantor Cabang / Capem / Fungsional"; // semua unit induk tanpa direktorat (selain Direksi)
// bidang dianggap "terpakai" di unit bila dipetakan ke ≥ TERPAKAI jabatan unit itu
const TERPAKAI = 0.2;
// indikator per level yang dianggap tipis untuk dijadikan dasar penilaian
const TIPIS = 1;
const PAGE = 1000; // max_rows PostgREST

const des = (n: number, d = 1) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const persen = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export default function Page() {
  return (
    <>
      <PageHeader
        title="Analisa Data"
        desc="Membaca kamus kompetensi dari sisi isi: seberapa dalam indikatornya, di mana bidang saling tumpang tindih, bagaimana level target tersebar per jenjang, dan apakah saran bidang awal terbukti di pemetaan."
      >
        <Link href="/kualitas" className="btn-secondary">
          Kualitas pemetaan →
        </Link>
      </PageHeader>
      <Suspense fallback={<DashboardSkeleton label="Memuat analisa data" />}>
        <Analisa />
      </Suspense>
    </>
  );
}

const STOP = new Set(["dan", "atau", "yang", "di", "ke", "dari", "untuk", "dengan", "bank", "&", "-", "serta", "pengelolaan", "mengelola", "melakukan", "melaksanakan", "menyusun", "penyusunan"]);
const tokens = (s: string) => new Set(s.toLowerCase().replace(/\(.*?\)/g, " ").split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));

type Hasil<T> = { data: T[] | null; error: { message: string } | null; count: number | null };
/** Semua baris sebuah query melewati batas max_rows: halaman pertama sekaligus menghitung total, sisanya paralel. */
async function semuaHalaman<T>(ambil: (from: number, to: number, hitung: boolean) => PromiseLike<Hasil<T>>): Promise<T[]> {
  const pertama = await ambil(0, PAGE - 1, true);
  const halaman = Math.ceil((pertama.count ?? 0) / PAGE);
  const sisa = await Promise.all(Array.from({ length: Math.max(0, halaman - 1) }, (_, i) => ambil((i + 1) * PAGE, (i + 2) * PAGE - 1, false).then(must)));
  return [must(pertama), ...sisa].flat();
}

async function Analisa() {
  const [komp, levelRows, terkait, bidang, unitCatatan, jabatan, pemetaan] = await Promise.all([
    supabase.from("v_kompetensi").select("kode, nama, status, catatan, kode_dokumen, tanda_c, bidang_kode, jumlah_level").order("urutan").then(must),
    semuaHalaman((from, to, hitung) =>
      supabase
        .from("v_level_indikator")
        .select("kode, nama, level, jumlah_indikator", hitung ? { count: "exact" } : undefined)
        .order("id")
        .range(from, to),
    ),
    supabase.from("kompetensi_bidang_terkait").select("catatan, kompetensi(kode, nama), bidang:bidang_kompetensi(kode, nama)").then(must),
    supabase.from("v_statistik_bidang").select("kode, nama, kategori, jumlah_kompetensi, jumlah_lengkap, jumlah_tanda_c, jumlah_indikator").order("urutan").then(must),
    supabase.from("unit_kerja").select("nama, catatan").not("catatan", "is", null).then(must),
    supabase.from("v_jabatan").select("id, unit_induk_nama, direktorat, jenjang").gt("jenjang", 0).then(must),
    semuaHalaman((from, to, hitung) =>
      supabase
        .from("v_jabatan_kompetensi")
        .select("jabatan_id, bidang_kode, kategori, level_target, jenjang", hitung ? { count: "exact" } : undefined)
        .order("id")
        .range(from, to),
    ),
  ]);

  const aktif = komp.filter((k) => k.status !== "dihapus");
  const bidangKode = new Map(aktif.map((k) => [k.kode!, k.bidang_kode!]));
  const levels = levelRows.filter((l) => bidangKode.has(l.kode!));
  const levelKosong = levels.filter((l) => !l.jumlah_indikator);
  const belumLengkap = aktif.filter((k) => k.status !== "lengkap");
  const renomor = komp.filter((k) => k.kode_dokumen);
  const denganCatatan = komp.filter((k) => (k.catatan?.length ?? 0) > 0 && !k.kode_dokumen);
  // siap pakai = status lengkap dan kelima levelnya berisi indikator
  const kodeLevelKosong = new Set(levelKosong.map((l) => l.kode));
  const siap = aktif.filter((k) => k.status === "lengkap" && !kodeLevelKosong.has(k.kode)).length;
  const indikator = levels.reduce((s, l) => s + (l.jumlah_indikator ?? 0), 0);
  const tipis = levels.filter((l) => (l.jumlah_indikator ?? 0) <= TIPIS);

  // ---- kedalaman indikator: bidang x level
  const bidangUrut = bidang.map((b) => b.kode!);
  const kedalaman = new Map<string, number[][]>(); // bidang -> [level-1] -> daftar jumlah indikator
  for (const l of levels) {
    const b = bidangKode.get(l.kode!)!;
    const m = kedalaman.get(b) ?? [[], [], [], [], []];
    m[(l.level ?? 1) - 1]?.push(l.jumlah_indikator ?? 0);
    kedalaman.set(b, m);
  }
  const rataLevel = [1, 2, 3, 4, 5].map((lv) => {
    const xs = levels.filter((l) => l.level === lv).map((l) => l.jumlah_indikator ?? 0);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
  });
  const lvTipis = rataLevel.indexOf(Math.min(...rataLevel)) + 1;
  const lvTebal = rataLevel.indexOf(Math.max(...rataLevel)) + 1;

  // ---- nama mirip antar bidang -> kandidat tumpang tindih
  const tk = aktif.map((k) => ({ ...k, t: tokens(k.nama ?? "") }));
  const mirip: { a: (typeof tk)[number]; b: (typeof tk)[number]; s: number }[] = [];
  for (let i = 0; i < tk.length; i++)
    for (let j = i + 1; j < tk.length; j++) {
      const a = tk[i], b = tk[j];
      if (a.bidang_kode === b.bidang_kode || !a.t.size || !b.t.size) continue;
      const inter = [...a.t].filter((w) => b.t.has(w)).length;
      const s = inter / (a.t.size + b.t.size - inter);
      if (s >= 0.5) mirip.push({ a, b, s });
    }
  mirip.sort((x, y) => y.s - x.s);
  const pasangan = new Map<string, number>();
  for (const { a, b } of mirip) {
    const key = [a.bidang_kode, b.bidang_kode].sort((x, y) => bidangUrut.indexOf(x!) - bidangUrut.indexOf(y!)).join("|");
    pasangan.set(key, (pasangan.get(key) ?? 0) + 1);
  }
  const pasanganUrut = [...pasangan.entries()].sort((x, y) => y[1] - x[1]);

  // ---- distribusi level target per jenjang
  const sebaran = [1, 2, 3, 4].map((jj) => {
    const lv = [0, 0, 0, 0, 0];
    for (const r of pemetaan) if (r.jenjang === jj && r.level_target) lv[r.level_target - 1]++;
    const total = lv.reduce((s, n) => s + n, 0);
    return { jj, lv, total, modus: lv.indexOf(Math.max(...lv)) + 1 };
  });
  const pelaksanaTinggi = sebaran.find((s) => s.jj === 4)?.lv.slice(3).reduce((s, n) => s + n, 0) ?? 0;

  // ---- saran bidang vs realisasi pemetaan
  const unitJabatan = new Map<number, string>();
  for (const j of jabatan) unitJabatan.set(j.id!, j.direktorat ? j.unit_induk_nama! : JARINGAN);
  const jabatanPerUnit = new Map<string, number>();
  for (const u of unitJabatan.values()) jabatanPerUnit.set(u, (jabatanPerUnit.get(u) ?? 0) + 1);
  const pakaiUnit = new Map<string, Map<string, Set<number>>>(); // unit -> bidang -> jabatan
  for (const r of pemetaan) {
    if (r.kategori !== "teknis") continue;
    const u = unitJabatan.get(r.jabatan_id!);
    if (!u) continue;
    const m = pakaiUnit.get(u) ?? new Map<string, Set<number>>();
    m.set(r.bidang_kode!, (m.get(r.bidang_kode!) ?? new Set()).add(r.jabatan_id!));
    pakaiUnit.set(u, m);
  }
  const saran = SARAN_BIDANG.map(([unit, kode]) => {
    const n = jabatanPerUnit.get(unit) ?? 0;
    const m = pakaiUnit.get(unit) ?? new Map<string, Set<number>>();
    const share = (b: string) => (n ? (m.get(b)?.size ?? 0) / n : 0);
    const disarankan = kode.map((b) => ({ b, share: share(b) }));
    const tambahan = [...m.keys()]
      .filter((b) => !kode.includes(b) && share(b) >= 0.3)
      .map((b) => ({ b, share: share(b) }))
      .sort((x, y) => y.share - x.share);
    return { unit, n, disarankan, tambahan };
  }).filter((s) => s.n > 0);
  const saranTotal = saran.reduce((s, x) => s + x.disarankan.length, 0);
  const saranTerbukti = saran.reduce((s, x) => s + x.disarankan.filter((d) => d.share >= TERPAKAI).length, 0);
  const adaPemetaan = pemetaan.length > 0;

  const fakta = [
    rataLevel.some(Boolean) && {
      angka: `L${lvTipis}`,
      teks: `level paling tipis: rata-rata ${des(rataLevel[lvTipis - 1], 2)} indikator per kompetensi, dibanding ${des(rataLevel[lvTebal - 1], 2)} di L${lvTebal}.`,
    },
    pasanganUrut.length > 0 && {
      angka: pasanganUrut[0][0].replace("|", " ↔ "),
      teks: `pasangan bidang dengan nama kompetensi paling mirip (${pasanganUrut[0][1]} pasangan). Kandidat untuk diselaraskan.`,
    },
    adaPemetaan && {
      angka: `${saranTerbukti}/${saranTotal}`,
      teks: `saran bidang awal per unit yang benar-benar dipakai ≥${TERPAKAI * 100}% jabatan unit itu.`,
    },
  ].filter((f) => f !== false);

  return (
    <div className="space-y-6">
      <Hero total={aktif.length} siap={siap} bidang={bidang.length} indikator={indikator} fakta={fakta} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon="M4 3.5h9.5a2 2 0 0 1 2 2v11H6a2 2 0 0 1-2-2zM4 14.5a2 2 0 0 1 2-2h9.5M7.5 7h5"
          label="Siap dipakai"
          value={<Hitung n={persen(siap, aktif.length)} akhiran="%" />}
          hint={siap === aktif.length ? "Semua kompetensi lengkap" : `${fmt(aktif.length - siap)} kompetensi perlu dilengkapi`}
          href={siap === aktif.length ? undefined : "#temuan"}
          aksen={siap === aktif.length ? "emerald" : "amber"}
        >
          <Batang
            className="mt-2"
            bagian={[
              { n: siap, kelas: "bg-emerald-500", label: "siap" },
              { n: aktif.length - siap, kelas: "bg-amber-400", label: "perlu dilengkapi" },
            ]}
          />
        </Stat>
        <Stat
          icon="M4 5.5h1.5M4 10h1.5M4 14.5h1.5M8.5 5.5h7.5M8.5 10h7.5M8.5 14.5h7.5"
          label="Indikator per level"
          value={des(levels.length ? indikator / levels.length : 0, 2)}
          hint={tipis.length ? `${tipis.length} level hanya punya ≤${TIPIS} indikator` : "Tidak ada level yang tipis"}
          href="#kedalaman"
          aksen={tipis.length ? "amber" : "brand"}
        />
        <Stat
          icon="M7 6a3.5 3.5 0 1 0 0 7M13 7a3.5 3.5 0 1 1 0 7"
          label="Kandidat tumpang tindih"
          value={<Hitung n={mirip.length} />}
          hint={`${pasangan.size} pasangan bidang terlibat`}
          href="#tumpang-tindih"
        />
        <Stat
          icon="M4.5 10.5l3.5 3.5 7.5-8"
          label="Saran bidang terbukti"
          value={adaPemetaan ? <Hitung n={persen(saranTerbukti, saranTotal)} akhiran="%" /> : "—"}
          hint={adaPemetaan ? `${saranTerbukti} dari ${saranTotal} saran dipakai di pemetaan` : "Belum ada pemetaan"}
          href="#saran"
          aksen={saranTerbukti === saranTotal ? "emerald" : "brand"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Kedalaman bidang={bidang} kedalaman={kedalaman} rataLevel={rataLevel} className="xl:col-span-3" />
        <SebaranLevel sebaran={sebaran} pelaksanaTinggi={pelaksanaTinggi} className="xl:col-span-2" />
      </div>

      <TumpangTindih pasangan={pasanganUrut} mirip={mirip} bidang={bidang} />

      {adaPemetaan && <Saran saran={saran} />}

      <section id="temuan" className="scroll-mt-6">
        <h2 className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Temuan dari dokumen sumber
          <span className="h-px flex-1 bg-slate-200" aria-hidden />
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Temuan judul="Kompetensi belum lengkap" n={belumLengkap.length + levelKosong.length} nada={belumLengkap.length + levelKosong.length ? "amber" : "emerald"}>
            <ul className="divide-y divide-slate-50 text-sm">
              {belumLengkap.map((k) => (
                <KRow key={k.kode} kode={k.kode!} nama={k.nama!}>
                  <StatusBadge status={k.status} />
                </KRow>
              ))}
              {levelKosong.map((l, i) => (
                <KRow key={`lv${i}`} kode={l.kode!} nama={l.nama!}>
                  <span className="text-xs text-amber-700">L{l.level} tanpa indikator</span>
                </KRow>
              ))}
            </ul>
          </Temuan>

          <Temuan judul="Catatan review di dokumen" n={denganCatatan.length} nada={denganCatatan.length ? "amber" : "emerald"}>
            <p className="px-4 pt-3 text-xs text-slate-500">
              Catatan diskusi yang masih tertulis di judul/isi dokumen, mis. target unit (&quot;&gt;&gt; Umum&quot;), batas level (&quot;sampai L-2&quot;), atau rencana pemindahan.
            </p>
            <ul className="divide-y divide-slate-50 text-sm">
              {denganCatatan.map((k) => (
                <li key={k.kode} className="px-4 py-2">
                  <Link href={`/kompetensi/${k.kode}`} className="hover:underline">
                    <span className="mr-2 font-mono text-xs text-slate-500">{k.kode}</span>
                    {k.nama}
                  </Link>
                  <div className="text-xs text-amber-800">{k.catatan?.join(" · ").slice(0, 220)}</div>
                </li>
              ))}
            </ul>
          </Temuan>

          <Temuan judul="Kompetensi lintas bidang" n={terkait.length}>
            <ul className="divide-y divide-slate-50 text-sm">
              {terkait.map((t, i) => (
                <li key={i} className="px-4 py-2">
                  <Link href={`/kompetensi/${t.kompetensi?.kode}`} className="font-medium hover:underline">
                    <span className="mr-2 font-mono text-xs text-slate-500">{t.kompetensi?.kode}</span>
                    {t.kompetensi?.nama}
                  </Link>
                  <div className="text-xs text-slate-500">
                    juga dicantumkan di kamus <b>{t.bidang?.nama}</b>
                    {t.catatan ? ` — ${t.catatan.slice(0, 160)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </Temuan>

          <Temuan judul="Kode dinormalisasi" n={renomor.length}>
            <p className="px-4 pt-3 text-xs text-slate-500">
              Kode di dokumen berbeda dengan kode yang dipakai di database (duplikat penomoran IAD, salah ketik prefix SBP/CSP).
            </p>
            <ul className="divide-y divide-slate-50 text-sm">
              {renomor.map((k) => (
                <KRow key={k.kode} kode={k.kode!} nama={k.nama!}>
                  <span className="font-mono text-xs text-slate-500">dok: {k.kode_dokumen}</span>
                </KRow>
              ))}
            </ul>
          </Temuan>

          <Temuan judul='Penanda "(C)" per bidang' n={bidang.reduce((s, b) => s + (b.jumlah_tanda_c ?? 0), 0)}>
            <ul className="space-y-2.5 p-4 text-sm">
              {bidang
                .filter((b) => b.jumlah_tanda_c)
                .map((b) => (
                  <li key={b.kode}>
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="min-w-0 truncate text-slate-700">
                        <span className="mr-1.5 font-mono text-xs text-slate-400">{b.kode}</span>
                        {b.nama}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-600">
                        {b.jumlah_tanda_c}/{b.jumlah_kompetensi}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-violet-400" style={{ width: `${persen(b.jumlah_tanda_c ?? 0, b.jumlah_kompetensi ?? 0)}%` }} />
                    </div>
                  </li>
                ))}
            </ul>
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Arti penanda &quot;(C)&quot; belum dijelaskan di dokumen — perlu dikonfirmasi.</p>
          </Temuan>

          <Temuan judul="Struktur organisasi" n={unitCatatan.length + 2}>
            <ul className="list-disc space-y-1 px-8 py-3 text-sm text-slate-700">
              {unitCatatan.map((u) => (
                <li key={u.nama}>
                  <b>{u.nama}</b>: {u.catatan}
                </li>
              ))}
              <li>Daftar jabatan dibangun dari dokumen jobdesk Perubahan Ketiga 2026 (satu dokumen = satu jabatan); atasan dari kolom &quot;Atasan Langsung&quot;, cadangan dari nomor dokumen.</li>
              <li>Atasan Pemimpin Cabang/Capem/Kantor Fungsional tertulis &quot;Direksi&quot; / &quot;Cabang Induk&quot; — tidak ditautkan ke jabatan tertentu.</li>
            </ul>
          </Temuan>
        </div>
      </section>
    </div>
  );
}

function Hero({ total, siap, bidang, indikator, fakta }: { total: number; siap: number; bidang: number; indikator: number; fakta: { angka: string; teks: string }[] }) {
  const p = persen(siap, total);
  const r = 52;
  const keliling = 2 * Math.PI * r;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900" aria-label="Ringkasan analisa kamus">
      {/* cahaya dekoratif */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />

      <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center lg:col-span-2">
          <div className="relative size-36 shrink-0 self-center">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/10" />
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke="url(#analisa-ring)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={keliling}
                strokeDashoffset={keliling * (1 - p / 100)}
                className="animate-[lingkar_1.1s_ease-out_both]"
                style={{ "--penuh": keliling } as React.CSSProperties}
              />
              <defs>
                <linearGradient id="analisa-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--color-amber-300)" />
                  <stop offset="100%" stopColor="var(--color-amber-500)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="font-heading text-3xl font-semibold tabular-nums">
                  <Hitung n={p} akhiran="%" />
                </div>
                <div className="text-[11px] uppercase tracking-wide text-brand-200">siap pakai</div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Kamus dalam angka</div>
            <p className="mt-1.5 font-heading text-xl font-medium leading-snug">
              {fmt(total)} kompetensi
              <span className="text-brand-200">
                {" "}
                di {bidang} bidang, dijabarkan dalam {fmt(indikator)} indikator perilaku.
              </span>
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 content-center gap-3 sm:grid-cols-3 lg:col-span-3">
          {fakta.map((f, i) => (
            <div key={i} className="animate-[masuk_0.45s_ease-out_both] rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10" style={{ animationDelay: `${200 + i * 100}ms` }}>
              <dt className="font-heading text-2xl font-semibold tabular-nums text-white">{f.angka}</dt>
              <dd className="mt-1 text-[13px] leading-snug text-brand-200">{f.teks}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// warna sel heatmap kedalaman: makin banyak indikator, makin pekat (kelas .lv1–.lv5 di globals.css)
const kelasKedalaman = (v: number) => (v <= 1.5 ? "lv1" : v <= 2 ? "lv2" : v <= 2.5 ? "lv3" : v <= 3 ? "lv4" : "lv5");

function Kedalaman({
  bidang,
  kedalaman,
  rataLevel,
  className = "",
}: {
  bidang: { kode: string | null; nama: string | null }[];
  kedalaman: Map<string, number[][]>;
  rataLevel: number[];
  className?: string;
}) {
  const rata = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return (
    <Card title="Kedalaman indikator per bidang & level" className={className}>
      <div id="kedalaman" className="scroll-mt-6 overflow-x-auto p-4">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="px-1 text-left font-medium">Bidang</th>
              {LEVEL_NAMA.map((n, i) => (
                <th key={n} className="w-14 font-medium" title={n}>
                  L{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bidang.map((b) => {
              const m = kedalaman.get(b.kode!);
              if (!m) return null;
              return (
                <tr key={b.kode}>
                  <td className="max-w-0 truncate px-1 text-slate-700" title={b.nama ?? ""}>
                    <span className="mr-1.5 font-mono text-xs text-slate-400">{b.kode}</span>
                    {b.nama?.replace(/\s*\(.*\)$/, "")}
                  </td>
                  {m.map((xs, i) => {
                    const v = rata(xs);
                    const tipis = xs.filter((x) => x <= TIPIS).length;
                    return (
                      <td
                        key={i}
                        className={`relative h-8 rounded text-center text-xs font-semibold tabular-nums ${kelasKedalaman(v)}`}
                        title={`${b.kode} L${i + 1}: rata-rata ${des(v, 2)} indikator dari ${xs.length} kompetensi${tipis ? ` · ${tipis} tipis` : ""}`}
                      >
                        {des(v)}
                        {tipis > 0 && <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-amber-500 ring-1 ring-white" aria-label={`${tipis} level tipis`} />}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-xs font-semibold text-slate-700">
              <td className="px-1 pt-1 text-slate-500">Rata-rata</td>
              {rataLevel.map((v, i) => (
                <td key={i} className="pt-1 text-center tabular-nums">
                  {des(v, 2)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Angka = rata-rata indikator perilaku per kompetensi.</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
            ada level dengan ≤{TIPIS} indikator — sulit dinilai
          </span>
        </p>
      </div>
    </Card>
  );
}

function SebaranLevel({ sebaran, pelaksanaTinggi, className = "" }: { sebaran: { jj: number; lv: number[]; total: number; modus: number }[]; pelaksanaTinggi: number; className?: string }) {
  const ada = sebaran.filter((s) => s.total);
  return (
    <Card title="Level target per jenjang" className={className}>
      {ada.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">Belum ada pemetaan.</p>
      ) : (
        <div className="p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(5,2.75rem)] gap-1 text-sm">
            <span />
            {LEVEL_NAMA.map((n, i) => (
              <span key={n} className="text-center text-xs font-medium text-slate-500" title={n}>
                L{i + 1}
              </span>
            ))}
            {ada.map((s) => (
              <div key={s.jj} className="contents">
                <span className="self-center truncate pr-2 text-xs leading-tight text-slate-700" title={JENJANG_LABEL[s.jj]}>
                  {JENJANG_LABEL[s.jj]}
                </span>
                {s.lv.map((n, i) => {
                  const p = s.total ? (n / s.total) * 100 : 0;
                  return (
                    <span
                      key={i}
                      className={`grid h-10 place-items-center rounded text-xs font-semibold tabular-nums ${p > 45 ? "text-white" : "text-slate-700"} ${i + 1 === s.modus ? "ring-2 ring-amber-400" : ""}`}
                      style={{ background: `color-mix(in oklab, var(--color-brand-700) ${Math.round(p)}%, var(--color-slate-50))` }}
                      title={`${JENJANG_LABEL[s.jj]} · L${i + 1}: ${n} pemetaan (${Math.round(p)}%)`}
                    >
                      {p >= 1 ? `${Math.round(p)}%` : n ? "<1%" : ""}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-600">
            Bingkai amber = level paling umum di jenjang itu.{" "}
            {ada.length > 1 && (
              <>
                Level target naik dari <b className="text-slate-800">L{ada.at(-1)!.modus}</b> ({JENJANG_LABEL[ada.at(-1)!.jj]}) ke{" "}
                <b className="text-slate-800">L{ada[0].modus}</b> ({JENJANG_LABEL[ada[0].jj]}).{" "}
              </>
            )}
            {pelaksanaTinggi > 0 ? (
              <span className="text-amber-800">{pelaksanaTinggi} pemetaan Pelaksana menargetkan L4–L5; periksa apakah wajar.</span>
            ) : (
              "Tidak ada Pelaksana yang ditargetkan L4–L5."
            )}
          </p>
        </div>
      )}
    </Card>
  );
}

function TumpangTindih({
  pasangan,
  mirip,
  bidang,
}: {
  pasangan: [string, number][];
  mirip: { a: { kode: string | null; nama: string | null; bidang_kode: string | null }; b: { kode: string | null; nama: string | null; bidang_kode: string | null }; s: number }[];
  bidang: { kode: string | null; nama: string | null }[];
}) {
  const maxN = Math.max(1, ...pasangan.map(([, n]) => n));
  const namaBidang = new Map(bidang.map((b) => [b.kode, b.nama?.replace(/\s*\(.*\)$/, "")]));
  return (
    <Card title={`Kandidat tumpang tindih antar bidang (${mirip.length})`}>
      <div id="tumpang-tindih" className="grid grid-cols-1 scroll-mt-6 divide-y divide-slate-100 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
        <div className="p-4 lg:col-span-2">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Pasangan bidang</h3>
          {pasangan.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada nama kompetensi yang mirip antar bidang.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {pasangan.slice(0, 10).map(([key, n], i) => {
                const [a, b] = key.split("|");
                return (
                  <li key={key} title={`${namaBidang.get(a)} ↔ ${namaBidang.get(b)}`}>
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {a} <span className="text-slate-400">↔</span> {b}
                      </span>
                      <span className="tabular-nums text-slate-600">{n}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-1.5 origin-left animate-[tumbuh_0.8s_ease-out_both] rounded-full bg-gradient-to-r from-violet-500 to-violet-300"
                        style={{ width: `${(n / maxN) * 100}%`, animationDelay: `${i * 50}ms` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="lg:col-span-3">
          <h3 className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Pasangan kompetensi paling mirip</h3>
          <ul className="max-h-96 divide-y divide-slate-50 overflow-y-auto text-sm">
            {mirip.slice(0, 40).map(({ a, b, s }, i) => (
              <li key={i} className="grid grid-cols-1 items-center gap-x-3 gap-y-1 px-4 py-2 sm:grid-cols-[1fr_1fr_3.5rem]">
                <Link href={`/kompetensi/${a.kode}`} className="min-w-0 hover:text-brand-700 hover:underline">
                  <span className="mr-2 font-mono text-xs text-slate-500">{a.kode}</span>
                  {a.nama}
                </Link>
                <Link href={`/kompetensi/${b.kode}`} className="min-w-0 hover:text-brand-700 hover:underline">
                  <span className="mr-2 font-mono text-xs text-slate-500">{b.kode}</span>
                  {b.nama}
                </Link>
                <span className="flex items-center gap-1.5 sm:justify-end">
                  <span className="h-1.5 w-8 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <span className="block h-full bg-violet-400" style={{ width: `${s * 100}%` }} />
                  </span>
                  <span className="text-xs tabular-nums text-slate-500">{Math.round(s * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
          {mirip.length > 40 && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">+ {mirip.length - 40} pasangan lain dengan kemiripan lebih rendah</p>}
        </div>
      </div>
    </Card>
  );
}

function Saran({ saran }: { saran: { unit: string; n: number; disarankan: { b: string; share: number }[]; tambahan: { b: string; share: number }[] }[] }) {
  return (
    <Card title="Saran bidang awal vs realisasi pemetaan">
      <div id="saran" className="scroll-mt-6">
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          <span>% = porsi jabatan unit yang memakai bidang itu.</span>
          <Legenda kelas="bg-emerald-50 text-emerald-800 ring-emerald-200" teks={`saran terpakai (≥${TERPAKAI * 100}%)`} />
          <Legenda kelas="bg-slate-50 text-slate-400 ring-slate-200 line-through" teks="saran jarang dipakai" />
          <Legenda kelas="bg-violet-50 text-violet-800 ring-violet-200" teks="dipakai ≥30% tapi tidak disarankan" />
        </div>
        <ul className="divide-y divide-slate-50 text-sm">
          {saran.map((s) => (
            <li key={s.unit} className="grid grid-cols-1 gap-2 px-4 py-2.5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center">
              <div className="min-w-0">
                {s.unit === JARINGAN ? (
                  <span className="text-slate-800">{s.unit}</span>
                ) : (
                  <Link href={`/matriks?${new URLSearchParams({ unit: s.unit, kategori: "teknis" })}`} className="text-slate-800 hover:text-brand-700 hover:underline">
                    {s.unit}
                  </Link>
                )}
                <span className="ml-2 text-xs text-slate-400">{s.n} jabatan</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.disarankan.map((d) => (
                  <Chip key={d.b} kode={d.b} share={d.share} kelas={d.share >= TERPAKAI ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-50 text-slate-400 ring-slate-200"} coret={d.share < TERPAKAI} />
                ))}
                {s.tambahan.map((d) => (
                  <Chip key={d.b} kode={d.b} share={d.share} kelas="bg-violet-50 text-violet-800 ring-violet-200" />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          Saran awal disusun sebelum pemetaan (tidak disimpan di database). Kompetensi Inti (CC) berlaku untuk semua jabatan dan Kepemimpinan (LC) untuk jabatan struktural.
        </p>
      </div>
    </Card>
  );
}

function Chip({ kode, share, kelas, coret = false }: { kode: string; share: number; kelas: string; coret?: boolean }) {
  return (
    <Link href={`/kompetensi?bidang=${kode}`} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ring-1 ring-inset hover:brightness-95 ${kelas}`}>
      <span className={`font-mono font-semibold ${coret ? "line-through" : ""}`}>{kode}</span>
      <span className="tabular-nums opacity-80">{Math.round(share * 100)}%</span>
    </Link>
  );
}

function Legenda({ kelas, teks }: { kelas: string; teks: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-5 rounded-sm ring-1 ring-inset ${kelas}`} aria-hidden />
      {teks}
    </span>
  );
}

/** Kartu temuan yang bisa dilipat; terbuka bila isinya sedikit. */
function Temuan({ judul, n, nada = "slate", children }: { judul: string; n: number; nada?: "amber" | "emerald" | "slate"; children: React.ReactNode }) {
  const warna = { amber: "bg-amber-50 text-amber-800 ring-amber-200", emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200", slate: "bg-slate-100 text-slate-600 ring-slate-200" }[nada];
  return (
    <details open={n > 0 && n <= 8} className="group self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex list-none items-center justify-between gap-3 bg-slate-50/70 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">{judul}</h3>
        <span className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset ${warna}`}>{n}</span>
          <span className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </span>
      </summary>
      <div className="max-h-96 overflow-y-auto border-t border-slate-200">{n ? children : <p className="px-4 py-3 text-sm text-slate-500">Tidak ada temuan.</p>}</div>
    </details>
  );
}

function KRow({ kode, nama, children }: { kode: string; nama: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <span className="w-16 shrink-0 font-mono text-xs text-slate-500">{kode}</span>
      <Link href={`/kompetensi/${kode}`} className="min-w-0 flex-1 truncate hover:underline">
        {nama}
      </Link>
      {children}
    </li>
  );
}

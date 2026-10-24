import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Hitung } from "@/components/hitung";
import { Batang, Card, Empty, PageHeader, ReviewBadge, Stat, Tag } from "@/components/ui";
import { penggunaSaatIni } from "@/lib/auth";
import { bolehEdit } from "@/lib/peran";
import { JENJANG_LABEL, KATEGORI_LABEL, REVIEW_BAR, REVIEW_LABEL, REVIEW_STATUS, fmt } from "@/lib/labels";
import { JabatanSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { must, supabase, type Views } from "@/lib/supabase";

export const metadata: Metadata = { title: "Daftar Jabatan" };

type Search = { kelompok?: string; q?: string; kelengkapan?: string; review?: string };
type Row = Pick<
  Views<"v_jabatan">,
  "id" | "kode" | "nama" | "kelompok_jabatan" | "unit_nama" | "unit_induk_nama" | "direktorat" | "atasan_id" | "jumlah_kompetensi" | "ikhtisar_jabatan" | "catatan" | "urutan" | "jenjang"
>;
type Komp = { jabatan_id: number | null; kategori: string | null; level_target: number | null; bidang_kode: string | null; bidang_nama: string | null };
// komposisi kompetensi satu jabatan per kategori + rata-rata level target
type Profil = { inti: number; kepemimpinan: number; teknis: number; level: number };

// Direksi (jenjang 0) tidak perlu jobdesk & kompetensi; hanya jabatan karyawan yang ditandai kekurangannya.
const perluPemetaan = (j: Row) => (j.jenjang ?? 0) > 0;

const KATEGORI = ["inti", "kepemimpinan", "teknis"] as const;
const KATEGORI_WARNA: Record<string, string> = { inti: "bg-brand-700", kepemimpinan: "bg-amber-400", teknis: "bg-sky-400" };
const PAGE = 1000; // max_rows PostgREST

const des = (n: number, d = 1) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const persen = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export default function Page(props: PageProps<"/jabatan">) {
  return (
    <>
      <PageHeader
        title="Daftar Jabatan"
        desc="Jabatan dari dokumen jobdesk Struktur Organisasi PT. BPD Sultra (Perubahan Ketiga, 10 Juli 2026), dikelompokkan per direktorat dan divisi/kantor, disusun mengikuti garis atasan."
      >
        <div className="flex flex-wrap gap-2">
          <a href="#daftar" className="btn-secondary">
            Lompat ke daftar ↓
          </a>
          {/* tombol tergantung peran akun (data per permintaan), jadi di-stream terpisah */}
          <Suspense fallback={null}>
            <TombolTambah />
          </Suspense>
        </div>
      </PageHeader>
      <Suspense fallback={<JabatanSkeleton />}>
        <List searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

/** Semua baris jabatan × kompetensi; halaman pertama sekaligus menghitung total, sisanya diambil paralel. */
async function loadKompetensi(): Promise<Komp[]> {
  const ambil = (from: number, hitung = false) =>
    supabase
      .from("v_jabatan_kompetensi")
      .select("jabatan_id, kategori, level_target, bidang_kode, bidang_nama", hitung ? { count: "exact" } : undefined)
      .order("id")
      .range(from, from + PAGE - 1);
  const pertama = await ambil(0, true);
  const total = pertama.count ?? 0;
  const sisa = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(total / PAGE) - 1) }, (_, i) => ambil((i + 1) * PAGE).then(must)));
  return [must(pertama), ...sisa].flat();
}

async function TombolTambah() {
  if (!bolehEdit((await penggunaSaatIni())?.peran)) return null;
  return (
    <Link href="/jabatan/baru" className="btn-primary">
      + Tambah jabatan
    </Link>
  );
}

async function List({ searchParams }: { searchParams: Promise<Search> }) {
  const { kelompok = "", q = "", kelengkapan = "", review = "" } = await searchParams;
  const [reviewRows, all, komp] = await Promise.all([
    supabase.from("v_review_jabatan").select("jabatan_id, status").then(must),
    supabase
      .from("v_jabatan")
      .select("id, kode, nama, kelompok_jabatan, unit_nama, unit_induk_nama, direktorat, atasan_id, jumlah_kompetensi, ikhtisar_jabatan, catatan, urutan, jenjang")
      // Direksi (jenjang 0) tidak dipetakan, jadi tidak ditampilkan di daftar
      .gt("jenjang", 0)
      .order("urutan")
      .then(must) as Promise<Row[]>,
    loadKompetensi(),
  ]);
  const statusReview = new Map(reviewRows.map((r) => [r.jabatan_id, r.status]));

  const profil = new Map<number, Profil>();
  for (const k of komp) {
    const p = profil.get(k.jabatan_id!) ?? { inti: 0, kepemimpinan: 0, teknis: 0, level: 0 };
    if (k.kategori === "inti" || k.kategori === "kepemimpinan" || k.kategori === "teknis") p[k.kategori]++;
    p.level += k.level_target ?? 0; // dibagi jumlah kompetensi di bawah
    profil.set(k.jabatan_id!, p);
  }
  for (const p of profil.values()) p.level /= p.inti + p.kepemimpinan + p.teknis || 1;

  const kelompokList = [...new Set(all.map((j) => j.kelompok_jabatan ?? ""))];
  const filtered = kelompok || q || kelengkapan || review;
  const cocokKelengkapan = (j: Row) => {
    if (kelengkapan && kelengkapan !== "lengkap" && !perluPemetaan(j)) return false;
    const jobdesk = !!j.ikhtisar_jabatan;
    const kompetensi = !!j.jumlah_kompetensi;
    if (kelengkapan === "belum") return !jobdesk || !kompetensi;
    if (kelengkapan === "tanpa-jobdesk") return !jobdesk;
    if (kelengkapan === "tanpa-kompetensi") return !kompetensi;
    if (kelengkapan === "lengkap") return jobdesk && kompetensi;
    return true;
  };
  const rows = all.filter(
    (j) =>
      (!kelompok || j.kelompok_jabatan === kelompok) &&
      cocokKelengkapan(j) &&
      (!review || statusReview.get(j.id!) === review) &&
      (!q || `${j.nama} ${j.unit_nama}`.toLowerCase().includes(q.toLowerCase())),
  );

  // group by direktorat, lalu unit induk, preserving chart order
  const direktorat = new Map<string, Map<string, Row[]>>();
  for (const j of rows) {
    const d = j.direktorat ?? "Kantor cabang & unit di luar direktorat";
    const units = direktorat.get(d) ?? new Map<string, Row[]>();
    const key = j.unit_induk_nama ?? "-";
    units.set(key, [...(units.get(key) ?? []), j]);
    direktorat.set(d, units);
  }
  const jumlahUnit = [...direktorat.values()].reduce((s, u) => s + u.size, 0);
  const maxKomp = Math.max(1, ...rows.map((j) => j.jumlah_kompetensi ?? 0));

  return (
    <div className="space-y-6">
      <Form action="" className="filter-bar">
        <label className="field-label min-w-56 flex-1">
          Cari
          <input name="q" defaultValue={q} placeholder="Nama jabatan atau unit…" className="field" />
        </label>
        <label className="field-label">
          Kelompok jabatan
          <select name="kelompok" defaultValue={kelompok} className="field">
            <option value="">Semua</option>
            {kelompokList.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Kelengkapan
          <select name="kelengkapan" defaultValue={kelengkapan} className="field">
            <option value="">Semua</option>
            <option value="belum">Belum terpetakan (jobdesk/kompetensi)</option>
            <option value="tanpa-jobdesk">Tanpa jobdesk</option>
            <option value="tanpa-kompetensi">Tanpa kompetensi</option>
            <option value="lengkap">Lengkap</option>
          </select>
        </label>
        <label className="field-label">
          Status review
          <select name="review" defaultValue={review} className="field">
            <option value="">Semua</option>
            {REVIEW_STATUS.map((s) => (
              <option key={s} value={s}>
                {REVIEW_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton>Terapkan</SubmitButton>
        {filtered && (
          <Link href="/jabatan" className="px-2 py-2 text-sm text-slate-500 hover:text-slate-900">
            Reset
          </Link>
        )}
      </Form>

      {rows.length === 0 ? (
        <Empty>Tidak ada jabatan yang cocok.</Empty>
      ) : (
        <Wawasan rows={rows} all={all} profil={profil} komp={komp} statusReview={statusReview} filtered={!!filtered} jumlahUnit={jumlahUnit} />
      )}

      {rows.length > 0 && (
        <div id="daftar" className="scroll-mt-6 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {fmt(rows.length)} jabatan <span className="font-normal text-slate-500">di {jumlahUnit} unit</span>
            </h2>
            <Legenda />
          </div>
          {[...direktorat.entries()].map(([d, units], i) => {
            const js = [...units.values()].flat();
            return (
              <section key={d} aria-labelledby={`dir-${i}`}>
                <h3 id={`dir-${i}`} className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {d}
                  <span className="h-px flex-1 bg-slate-200" aria-hidden />
                  <span className="font-normal normal-case tracking-normal text-slate-400">
                    {units.size} unit · {js.length} jabatan
                  </span>
                </h3>
                <div className="gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
                  {[...units.entries()].map(([unit, items]) => (
                    <KartuUnit key={unit} unit={unit} items={items} filtered={!!filtered} profil={profil} komp={komp} statusReview={statusReview} maxKomp={maxKomp} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Wawasan (dihitung atas hasil filter) ---------- */

function Wawasan({
  rows,
  all,
  profil,
  komp,
  statusReview,
  filtered,
  jumlahUnit,
}: {
  rows: Row[];
  all: Row[];
  profil: Map<number, Profil>;
  komp: Komp[];
  statusReview: Map<number | null, string | null>;
  filtered: boolean;
  jumlahUnit: number;
}) {
  const karyawan = rows.filter(perluPemetaan);
  const lengkap = karyawan.filter((j) => j.ikhtisar_jabatan && j.jumlah_kompetensi).length;
  const belum = karyawan.length - lengkap;
  const reviewN = Object.fromEntries(REVIEW_STATUS.map((s) => [s, karyawan.filter((j) => (statusReview.get(j.id!) ?? "draf") === s).length]));

  const komps = karyawan.map((j) => j.jumlah_kompetensi ?? 0).filter(Boolean);
  const rataKomp = komps.length ? komps.reduce((s, n) => s + n, 0) / komps.length : 0;
  const ids = new Set(karyawan.map((j) => j.id));
  const campuran = KATEGORI.map((k) => ({ n: komp.filter((r) => r.kategori === k && ids.has(r.jabatan_id)).length, kelas: KATEGORI_WARNA[k], label: KATEGORI_LABEL[k].toLowerCase() }));

  return (
    <div className="space-y-6">
      <Hero rows={rows} all={all} profil={profil} filtered={filtered} jumlahUnit={jumlahUnit} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon="M7.5 3.5h5v4h-5zM3 13h5v3.5H3zM12 13h5v3.5h-5zM10 7.5V10M5.5 13v-3h9v3"
          label="Jabatan karyawan"
          value={<Hitung n={karyawan.length} />}
          hint={`${rows.length - karyawan.length ? `+ ${rows.length - karyawan.length} direksi · ` : ""}${jumlahUnit} unit`}
        />
        <Stat
          icon="M4.5 10.5l3.5 3.5 7.5-8"
          label="Jobdesk & kompetensi lengkap"
          value={<Hitung n={persen(lengkap, karyawan.length)} akhiran="%" />}
          hint={belum ? `${fmt(belum)} jabatan belum lengkap` : "Semua jabatan lengkap"}
          href={belum ? "/jabatan?kelengkapan=belum" : undefined}
          aksen={belum ? "amber" : "emerald"}
        >
          <Batang
            className="mt-2"
            bagian={[
              { n: lengkap, kelas: "bg-emerald-500", label: "lengkap" },
              { n: belum, kelas: "bg-amber-400", label: "belum lengkap" },
            ]}
          />
        </Stat>
        <Stat
          icon="M3.5 3.5h13v13h-13zM3.5 8h13M3.5 12.5h13M8 3.5v13M12.5 3.5v13"
          label="Kompetensi per jabatan"
          value={des(rataKomp)}
          hint={komps.length ? `rentang ${Math.min(...komps)}–${Math.max(...komps)} · rata-rata` : "Belum ada pemetaan"}
          href="/matriks"
        >
          <Batang className="mt-2" bagian={campuran} />
        </Stat>
        <Stat
          icon="M4 4.5h12M4 10h7M4 15.5h5M13 14l2 2 3.5-4"
          label="Pemetaan selesai"
          value={<Hitung n={persen(reviewN.selesai, karyawan.length)} akhiran="%" />}
          hint={`${fmt(reviewN.draf)} jabatan masih draf`}
          href="/review"
          aksen={reviewN.selesai === karyawan.length ? "emerald" : "amber"}
        >
          <Batang className="mt-2" bagian={REVIEW_STATUS.map((s) => ({ n: reviewN[s], kelas: REVIEW_BAR[s], label: REVIEW_LABEL[s].toLowerCase() }))} />
        </Stat>
      </div>

      <Perhatian belum={belum} reviewN={reviewN} />

      <div className="grid gap-6 xl:grid-cols-3">
        <ProfilJenjang karyawan={karyawan} profil={profil} className="xl:col-span-2" />
        <SebaranBidang komp={komp} ids={ids} total={karyawan.length} />
      </div>
    </div>
  );
}

function Hero({ rows, all, profil, filtered, jumlahUnit }: { rows: Row[]; all: Row[]; profil: Map<number, Profil>; filtered: boolean; jumlahUnit: number }) {
  const perJenjang = [0, 1, 2, 3, 4].map((j) => ({ j, n: rows.filter((r) => (r.jenjang ?? 4) === j).length })).filter((p) => p.n);
  const maxN = Math.max(1, ...perJenjang.map((p) => p.n));
  const jumlahDirektorat = new Set(rows.map((j) => j.direktorat).filter(Boolean)).size;

  const pejabat = rows.filter((j) => (j.jenjang ?? 0) >= 1 && (j.jenjang ?? 0) <= 3).length;
  const pelaksana = rows.filter((j) => j.jenjang === 4).length;

  // rentang kendali: bawahan langsung (dari seluruh struktur) bagi jabatan yang tampil
  const bawahan = new Map<number, number>();
  for (const j of all) if (j.atasan_id) bawahan.set(j.atasan_id, (bawahan.get(j.atasan_id) ?? 0) + 1);
  const atasan = rows.filter((j) => bawahan.get(j.id!));
  const rataBawahan = atasan.length ? atasan.reduce((s, j) => s + bawahan.get(j.id!)!, 0) / atasan.length : 0;
  const terluas = atasan.reduce<Row | null>((m, j) => (!m || bawahan.get(j.id!)! > bawahan.get(m.id!)! ? j : m), null);

  const levelJenjang = (n: number) => {
    const ps = rows.filter((j) => j.jenjang === n).map((j) => profil.get(j.id!)?.level ?? 0).filter(Boolean);
    return ps.length ? ps.reduce((s, x) => s + x, 0) / ps.length : 0;
  };
  const levelBawah = levelJenjang(4);
  const levelAtas = levelJenjang(1);

  const fakta = [
    pejabat && pelaksana
      ? { angka: `1 : ${des(pelaksana / pejabat)}`, teks: `Rasio pejabat struktural (${pejabat}) terhadap pelaksana (${pelaksana}).` }
      : null,
    terluas
      ? {
          angka: des(rataBawahan),
          teks: (
            <>
              Rata-rata bawahan langsung per atasan. Terluas:{" "}
              <Link href={`/jabatan/${terluas.kode}`} className="font-medium text-white underline decoration-white/30 underline-offset-2 hover:decoration-white">
                {terluas.nama}
              </Link>{" "}
              ({bawahan.get(terluas.id!)} orang).
            </>
          ),
        }
      : null,
    levelBawah && levelAtas
      ? { angka: `L${des(levelBawah)} → L${des(levelAtas)}`, teks: "Rata-rata level target kompetensi, dari Pelaksana ke Kepala Divisi / Pemimpin." }
      : null,
  ].filter((f) => f !== null);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900" aria-label="Struktur jabatan">
      {/* cahaya dekoratif */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />

      <div className="relative grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">{filtered ? "Struktur jabatan · hasil filter" : "Struktur jabatan"}</div>
          <p className="mt-1.5 font-heading text-xl font-medium leading-snug">
            {fmt(rows.length)} jabatan
            <span className="text-brand-200">
              {" "}
              tersebar di {jumlahUnit} unit{jumlahDirektorat ? ` dan ${jumlahDirektorat} direktorat` : ""}.
            </span>
          </p>

          {/* piramida jenjang: batang terpusat, lebar sebanding jumlah jabatan */}
          <div className="mt-5 space-y-1.5" role="list" aria-label="Jumlah jabatan per jenjang">
            {perJenjang.map(({ j, n }, i) => (
              <div key={j} role="listitem" className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-right text-xs leading-tight text-brand-100 sm:w-44">{JENJANG_LABEL[j]}</span>
                <div className="flex flex-1 justify-center">
                  <div
                    className={`flex h-7 min-w-9 origin-center animate-[tumbuh_0.8s_ease-out_both] items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                      j === 0 ? "bg-gradient-to-r from-amber-400 to-amber-300 text-brand-950" : "bg-gradient-to-r from-brand-500 to-brand-400 text-white"
                    }`}
                    style={{ width: `${(n / maxN) * 100}%`, animationDelay: `${i * 90}ms` }}
                    title={`${JENJANG_LABEL[j]}: ${n} jabatan`}
                  >
                    {n}
                  </div>
                </div>
                <span className="w-10 shrink-0 text-xs tabular-nums text-brand-300">{persen(n, rows.length)}%</span>
              </div>
            ))}
          </div>
        </div>

        {fakta.length > 0 && (
          <dl className="grid content-center gap-3 lg:col-span-2">
            {fakta.map((f, i) => (
              <div key={i} className="animate-[masuk_0.45s_ease-out_both] rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10" style={{ animationDelay: `${200 + i * 100}ms` }}>
                <dt className="sr-only">Fakta {i + 1}</dt>
                <dd>
                  <div className="font-heading text-2xl font-semibold tabular-nums text-white">{f.angka}</div>
                  <div className="mt-0.5 text-[13px] leading-snug text-brand-200">{f.teks}</div>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

/** Pekerjaan tertunda; hanya tampil bila ada. */
function Perhatian({ belum, reviewN }: { belum: number; reviewN: Record<string, number> }) {
  const item = [
    { n: belum, teks: "jabatan belum punya jobdesk/kompetensi", href: "/jabatan?kelengkapan=belum", kuat: true },
    { n: reviewN.draf, teks: "jabatan masih draf, belum ditandai selesai", href: "/jabatan?review=draf", kuat: false },
  ].filter((x) => x.n > 0);
  if (!item.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm">
      <span className="mr-1 flex items-center gap-1.5 font-semibold text-amber-900">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-4" aria-hidden>
          <path d="M10 3 2.5 16.5h15zM10 8v4M10 14.3v.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Perlu perhatian
      </span>
      {item.map((x) => (
        <Link
          key={x.href}
          href={x.href}
          className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 ring-inset transition-colors ${
            x.kuat ? "bg-white text-amber-900 ring-amber-300 hover:bg-amber-100" : "bg-white/60 text-slate-700 ring-slate-200 hover:bg-white"
          }`}
        >
          <span className="font-semibold tabular-nums">{fmt(x.n)}</span> {x.teks}
          <span className="text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden>
            →
          </span>
        </Link>
      ))}
    </div>
  );
}

function ProfilJenjang({ karyawan, profil, className = "" }: { karyawan: Row[]; profil: Map<number, Profil>; className?: string }) {
  const baris = [1, 2, 3, 4]
    .map((jj) => {
      const ps = karyawan.filter((j) => j.jenjang === jj).map((j) => profil.get(j.id!)).filter((p) => p !== undefined);
      if (!ps.length) return null;
      const rata = (k: keyof Profil) => ps.reduce((s, p) => s + p[k], 0) / ps.length;
      return { jj, n: ps.length, inti: rata("inti"), kepemimpinan: rata("kepemimpinan"), teknis: rata("teknis"), level: rata("level") };
    })
    .filter((b) => b !== null);
  const maxTotal = Math.max(0.01, ...baris.map((b) => b.inti + b.kepemimpinan + b.teknis));
  const atas = baris[0];
  const bawah = baris.at(-1);

  return (
    <Card title="Profil kompetensi per jenjang" className={className} action={<Legenda />}>
      {baris.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">Belum ada jabatan terpetakan pada filter ini.</p>
      ) : (
        <div className="p-4">
          <div className="mb-2 hidden justify-end gap-4 pr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:flex">
            <span className="w-28 text-right">Level target</span>
          </div>
          <ul className="space-y-4">
            {baris.map((b, i) => {
              const total = b.inti + b.kepemimpinan + b.teknis;
              return (
                <li key={b.jj} className="grid items-center gap-x-4 gap-y-1.5 sm:grid-cols-[11rem_1fr_7rem]">
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-slate-800">{JENJANG_LABEL[b.jj]}</div>
                    <div className="text-xs text-slate-500">
                      {b.n} jabatan · {des(total)} kompetensi
                    </div>
                  </div>
                  <div
                    className="flex h-7 origin-left animate-[tumbuh_0.8s_ease-out_both] gap-0.5 overflow-hidden rounded-md"
                    style={{ width: `${(total / maxTotal) * 100}%`, animationDelay: `${i * 80}ms` }}
                    role="img"
                    aria-label={KATEGORI.map((k) => `${des(b[k])} ${KATEGORI_LABEL[k].toLowerCase()}`).join(", ")}
                  >
                    {KATEGORI.map(
                      (k) =>
                        b[k] > 0 && (
                          <span
                            key={k}
                            className={`grid place-items-center text-[11px] font-semibold tabular-nums ${KATEGORI_WARNA[k]} ${k === "kepemimpinan" ? "text-brand-950" : "text-white"}`}
                            style={{ width: `${(b[k] / total) * 100}%` }}
                            title={`${KATEGORI_LABEL[k]}: rata-rata ${des(b[k])}`}
                          >
                            {des(b[k])}
                          </span>
                        ),
                    )}
                  </div>
                  <Meter level={b.level} />
                </li>
              );
            })}
          </ul>
          {atas && bawah && atas !== bawah && (
            <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">{JENJANG_LABEL[atas.jj]}</span> memegang rata-rata {des(atas.inti + atas.kepemimpinan + atas.teknis)} kompetensi
              {atas.kepemimpinan > 0 ? ` (${des(atas.kepemimpinan)} kepemimpinan)` : ""} dengan level target L{des(atas.level)}, sedangkan{" "}
              <span className="font-semibold text-slate-800">{JENJANG_LABEL[bawah.jj]}</span> {des(bawah.inti + bawah.kepemimpinan + bawah.teknis)} kompetensi
              {bawah.kepemimpinan > 0 ? ` (${des(bawah.kepemimpinan)} kepemimpinan)` : " tanpa kompetensi kepemimpinan"} di L{des(bawah.level)}.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/** Level target rata-rata 1–5 sebagai lima segmen; segmen terakhir terisi sebagian. */
function Meter({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-2 sm:justify-end" title={`Rata-rata level target ${des(level, 2)}`}>
      <div className="flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((l) => (
          <span key={l} className="h-3 w-2.5 overflow-hidden rounded-sm bg-slate-100">
            <span className="block h-full bg-brand-600" style={{ width: `${Math.max(0, Math.min(1, level - l + 1)) * 100}%` }} />
          </span>
        ))}
      </div>
      <span className="w-9 text-right text-sm font-semibold tabular-nums text-slate-800">L{des(level)}</span>
    </div>
  );
}

function SebaranBidang({ komp, ids, total }: { komp: Komp[]; ids: Set<number | null>; total: number }) {
  // jumlah jabatan (bukan baris) yang memakai tiap bidang teknis
  const pakai = new Map<string, { nama: string; jabatan: Set<number> }>();
  for (const k of komp) {
    if (k.kategori !== "teknis" || !ids.has(k.jabatan_id)) continue;
    const b = pakai.get(k.bidang_kode!) ?? { nama: k.bidang_nama ?? k.bidang_kode!, jabatan: new Set() };
    b.jabatan.add(k.jabatan_id!);
    pakai.set(k.bidang_kode!, b);
  }
  const daftar = [...pakai.entries()].map(([kode, b]) => ({ kode, nama: b.nama, n: b.jabatan.size })).sort((a, b) => b.n - a.n);
  const maxN = Math.max(1, ...daftar.map((d) => d.n));

  return (
    <Card title="Bidang teknis terpakai"action={<Link href="/kompetensi" className="link text-xs">Kamus →</Link>}>
      {daftar.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">Belum ada kompetensi teknis pada filter ini.</p>
      ) : (
        <ul className="space-y-2.5 p-4 text-sm">
          {daftar.slice(0, 8).map((d, i) => (
            <li key={d.kode}>
              <Link href={`/kompetensi?bidang=${d.kode}`} className="group block" title={d.nama}>
                <div className="mb-1 flex justify-between gap-2">
                  <span className="min-w-0 truncate text-slate-800 group-hover:text-brand-700">
                    <span className="mr-1.5 font-mono text-xs text-slate-400">{d.kode}</span>
                    {d.nama}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {d.n} <span className="text-xs text-slate-400">· {persen(d.n, total)}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-1.5 origin-left animate-[tumbuh_0.8s_ease-out_both] rounded-full bg-gradient-to-r from-sky-500 to-sky-300"
                    style={{ width: `${(d.n / maxN) * 100}%`, animationDelay: `${i * 50}ms` }}
                  />
                </div>
              </Link>
            </li>
          ))}
          {daftar.length > 8 && <li className="pt-1 text-xs text-slate-500">+ {daftar.length - 8} bidang lain</li>}
        </ul>
      )}
    </Card>
  );
}

function Legenda() {
  return (
    <span className="flex items-center gap-3 text-[11px] font-medium normal-case tracking-normal text-slate-500">
      {KATEGORI.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-sm ${KATEGORI_WARNA[k]}`} aria-hidden />
          {KATEGORI_LABEL[k]}
        </span>
      ))}
    </span>
  );
}

/* ---------- Daftar per unit ---------- */

function KartuUnit({
  unit,
  items,
  filtered,
  profil,
  komp,
  statusReview,
  maxKomp,
}: {
  unit: string;
  items: Row[];
  filtered: boolean;
  profil: Map<number, Profil>;
  komp: Komp[];
  statusReview: Map<number | null, string | null>;
  maxKomp: number;
}) {
  const karyawan = items.filter(perluPemetaan);
  const ids = new Set(karyawan.map((j) => j.id));
  const komps = karyawan.map((j) => j.jumlah_kompetensi ?? 0).filter(Boolean);
  const rata = komps.length ? komps.reduce((s, n) => s + n, 0) / komps.length : 0;
  // bidang teknis yang paling sering dipetakan ke jabatan unit ini
  const fokus = new Map<string, { nama: string; n: number }>();
  for (const k of komp) {
    if (k.kategori !== "teknis" || !ids.has(k.jabatan_id)) continue;
    const f = fokus.get(k.bidang_kode!) ?? { nama: k.bidang_nama ?? "", n: 0 };
    f.n++;
    fokus.set(k.bidang_kode!, f);
  }
  const fokusTeratas = [...fokus.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <header className="border-b border-slate-100 px-4 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-heading text-[15px] font-semibold leading-snug text-slate-900">{unit}</h4>
          <a
            href={`/dokumen/jobdesk?unit=${encodeURIComponent(unit)}`}
            target="_blank"
            rel="noopener"
            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
            title="Uraian tugas seluruh jabatan unit ini (PDF)"
          >
            PDF ↗
          </a>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{items.length} jabatan</span>
          {rata > 0 && <span>±{des(rata)} kompetensi/jabatan</span>}
          {fokusTeratas.length > 0 && (
            <span className="flex items-center gap-1">
              Fokus:
              {fokusTeratas.map(([kode, f]) => (
                <span key={kode} title={f.nama} className="rounded bg-sky-50 px-1.5 py-px font-mono text-[11px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">
                  {kode}
                </span>
              ))}
            </span>
          )}
        </div>
        {karyawan.length > 0 && (
          <Batang
            className="mt-2.5"
            bagian={REVIEW_STATUS.map((s) => ({
              n: karyawan.filter((j) => (statusReview.get(j.id!) ?? "draf") === s).length,
              kelas: REVIEW_BAR[s],
              label: REVIEW_LABEL[s].toLowerCase(),
            }))}
          />
        )}
      </header>
      <ul className="py-1 text-sm">
        {(filtered ? items.map((j) => ({ j, depth: 0 })) : asTree(items)).map(({ j, depth }) => {
          const p = profil.get(j.id!);
          const status = statusReview.get(j.id!);
          return (
            <li key={j.kode}>
              <Link href={`/jabatan/${j.kode}`} className="group flex items-center gap-2 py-1.5 pr-4 hover:bg-brand-50/50" style={{ paddingLeft: 16 + depth * 18 }}>
                {depth > 0 && <span className="text-slate-300">└</span>}
                <span className="min-w-0">
                  <span className={`group-hover:text-brand-700 ${j.kelompok_jabatan === "Pelaksana" ? "text-slate-700" : "font-medium text-slate-900"}`}>{j.nama}</span>
                  {filtered && <span className="ml-2 text-xs text-slate-500">{j.unit_nama}</span>}
                </span>
                {j.catatan && <Tag title={j.catatan}>catatan</Tag>}
                {status === "selesai" && <ReviewBadge status={status} />}
                {perluPemetaan(j) && !j.ikhtisar_jabatan && <Gap>tanpa jobdesk</Gap>}
                {perluPemetaan(j) && !j.jumlah_kompetensi && <Gap>tanpa kompetensi</Gap>}
                {p && (
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    <Dna p={p} total={j.jumlah_kompetensi ?? 0} max={maxKomp} />
                    <span className="w-5 text-right text-xs tabular-nums text-slate-500">{j.jumlah_kompetensi}</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Batang mini komposisi kompetensi satu jabatan; panjangnya sebanding jumlah kompetensi. */
function Dna({ p, total, max }: { p: Profil; total: number; max: number }) {
  const label = KATEGORI.map((k) => `${p[k]} ${KATEGORI_LABEL[k].toLowerCase()}`).join(", ");
  return (
    <span className="hidden w-16 sm:block" title={`${label} · level target rata-rata ${des(p.level)}`}>
      <span className="flex h-1.5 gap-px overflow-hidden rounded-full" style={{ width: `${(total / max) * 100}%` }} role="img" aria-label={label}>
        {KATEGORI.map((k) => p[k] > 0 && <span key={k} className={`block ${KATEGORI_WARNA[k]}`} style={{ width: `${(p[k] / total) * 100}%` }} />)}
      </span>
    </span>
  );
}

function Gap({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">{children}</span>;
}

/** Depth-first order following atasan_id inside one unit group. */
function asTree(items: Row[]) {
  const ids = new Set(items.map((j) => j.id));
  const children = new Map<number | null, Row[]>();
  for (const j of items) {
    const p = j.atasan_id && ids.has(j.atasan_id) ? j.atasan_id : null;
    children.set(p, [...(children.get(p) ?? []), j]);
  }
  const out: { j: Row; depth: number }[] = [];
  const walk = (p: number | null, depth: number) => {
    for (const j of children.get(p) ?? []) {
      out.push({ j, depth });
      walk(j.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

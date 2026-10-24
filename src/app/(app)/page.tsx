import Link from "next/link";
import { Suspense } from "react";
import { Hitung } from "@/components/hitung";
import { Batang, Card, PageHeader, Stat } from "@/components/ui";
import { DashboardSkeleton } from "@/components/skeleton";
import { sesiSaatIni } from "@/lib/auth";
import { KATEGORI_LABEL, LEVEL_NAMA, REVIEW_BAR, REVIEW_LABEL, REVIEW_STATUS, fmt } from "@/lib/labels";
import { PENILAIAN_DIRI_AKTIF } from "@/lib/fitur";
import { MENU } from "@/lib/menu";
import { admin } from "@/lib/supabase-admin";
import { must, supabase } from "@/lib/supabase";

export default function Home() {
  return (
    <>
      <PageHeader
        title="Ringkasan"
        desc="Kamus kompetensi (inti, kepemimpinan, dan 13 bidang teknis) serta daftar jabatan beserta jobdesk dari struktur organisasi Perubahan Ketiga Tahun 2026."
      >
        {/* nama pengguna dibaca dari cookie, jadi di-stream terpisah dari kerangka halaman */}
        <Suspense fallback={null}>
          <Salam />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Salam() {
  const s = await sesiSaatIni();
  if (!s) return null;
  // Bank Sultra berada di zona WITA
  const jam = Number(new Intl.DateTimeFormat("id-ID", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Makassar" }).format(new Date()));
  const waktu = jam < 11 ? "pagi" : jam < 15 ? "siang" : jam < 19 ? "sore" : "malam";
  return (
    <div className="animate-[masuk_0.4s_ease-out_both] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-right shadow-xs">
      <div className="text-sm font-semibold text-slate-900">
        Selamat {waktu}, {s.nama.split(" ")[0]}
      </div>
      <div className="text-xs text-slate-500">Data struktur per 10 Juli 2026</div>
    </div>
  );
}

const KATEGORI_URUT = ["inti", "kepemimpinan", "teknis"];
// warna batang per level, sama dengan sel heatmap di Matriks (.lv1–.lv5 di globals.css)
const LEVEL_KELAS = ["lv1", "lv2", "lv3", "lv4", "lv5"];
// jumlah baris yang langsung tampil di daftar tugas; sisanya di balik "Lihat semua"
const BATAS_TAMPIL = 8;

async function Dashboard() {
  const sesi = await sesiSaatIni();
  const [bidang, jabatan, levels, bagan, review, pemakaian, penilaian] = await Promise.all([
    supabase.from("v_statistik_bidang").select("*").order("urutan").then(must),
    supabase.from("v_jabatan").select("kode, nama, unit_induk_nama, kelompok_jabatan, unit_jenis, jenjang, ikhtisar_jabatan, jumlah_kompetensi").order("urutan").then(must),
    supabase.from("v_statistik_level").select("*").order("level").then(must),
    supabase.from("bagan_tanpa_jobdesk").select("label, unit:unit_kerja(nama)").order("urutan").then(must),
    supabase.from("v_review_jabatan").select("status").then(must),
    supabase.from("v_kompetensi_pemakaian").select("kategori, status, jumlah_jabatan").then(must),
    PENILAIAN_DIRI_AKTIF
      ? admin()
          .from("penilaian_diri")
          .select("id", { count: "exact", head: true })
          .eq("pengguna_id", sesi?.id ?? -1)
          .then((r) => r.count ?? 0)
      : 0,
  ]);

  const total = (k: keyof (typeof bidang)[number]) => bidang.reduce((s, b) => s + ((b[k] as number) ?? 0), 0);
  const kompetensi = total("jumlah_kompetensi");
  const lengkap = total("jumlah_lengkap");
  const perluKompetensi = total("jumlah_perlu_tindak_lanjut");
  const indikator = total("jumlah_indikator");
  const maxK = Math.max(1, ...bidang.map((b) => b.jumlah_kompetensi ?? 0));
  const perKategori = KATEGORI_URUT.map((k) => ({ k, bs: bidang.filter((b) => b.kategori === k) })).filter((g) => g.bs.length);

  const perKelompok = new Map<string, number>();
  for (const j of jabatan) perKelompok.set(j.kelompok_jabatan ?? "-", (perKelompok.get(j.kelompok_jabatan ?? "-") ?? 0) + 1);
  const kelompok = [...perKelompok.entries()].sort((a, b) => b[1] - a[1]);
  // Direksi (jenjang 0) tidak perlu jobdesk & kompetensi, jadi progres pemetaan dihitung atas jabatan karyawan saja
  const karyawan = jabatan.filter((j) => (j.jenjang ?? 0) > 0);
  const terpetakan = karyawan.filter((j) => (j.jumlah_kompetensi ?? 0) > 0).length;
  const berJobdesk = karyawan.filter((j) => j.ikhtisar_jabatan).length;
  const belum = karyawan.filter((j) => !j.ikhtisar_jabatan || !j.jumlah_kompetensi);
  const tanpaJobdesk = belum.filter((j) => !j.ikhtisar_jabatan).length;
  const tanpaKompetensi = belum.filter((j) => !j.jumlah_kompetensi).length;
  const pemetaan = jabatan.reduce((s, j) => s + (j.jumlah_kompetensi ?? 0), 0);
  const baganPerUnit = new Map<string, string[]>();
  for (const b of bagan) baganPerUnit.set(b.unit?.nama ?? "-", [...(baganPerUnit.get(b.unit?.nama ?? "-") ?? []), b.label]);

  const maxAvg = Math.max(0.01, ...levels.map((l) => l.rata_indikator ?? 0));
  const jumlahLevel = levels.reduce((s, l) => s + (l.jumlah_level ?? 0), 0);

  const reviewN = Object.fromEntries(REVIEW_STATUS.map((s) => [s, review.filter((r) => (r.status ?? "draf") === s).length]));
  const selesai = review.length ? Math.round((reviewN.selesai / review.length) * 100) : 0;
  const teknisNganggur = pemakaian.filter((k) => k.kategori === "teknis" && k.status === "lengkap" && !k.jumlah_jabatan).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Hero
          className="xl:col-span-2"
          total={karyawan.length}
          lengkap={karyawan.length - belum.length}
          berJobdesk={berJobdesk}
          terpetakan={terpetakan}
          sisaJabatan={belum.length}
          sisaBagan={bagan.length}
        />
        <AksesCepat
          info={{
            "/penilaian-diri": penilaian ? `${fmt(penilaian)} penilaian Anda` : "Belum ada penilaian",
            "/matriks": "Heatmap jabatan × kompetensi",
            "/karier": "Kedekatan antarjabatan",
            "/review": `${selesai}% jabatan selesai`,
            "/kualitas": teknisNganggur ? `${teknisNganggur} kompetensi teknis belum dipakai` : "Semua kompetensi teknis dipakai",
          }}
          review={{ n: reviewN, total: review.length }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon="M4 3.5h9.5a2 2 0 0 1 2 2v11H6a2 2 0 0 1-2-2zM4 14.5a2 2 0 0 1 2-2h9.5M7.5 7h5"
          label="Kompetensi"
          value={<Hitung n={kompetensi} />}
          hint={perluKompetensi ? `${fmt(lengkap)} lengkap · ${fmt(perluKompetensi)} perlu dilengkapi` : `Semua lengkap · ${bidang.length} bidang`}
          href={perluKompetensi ? "/kompetensi?fokus=perlu" : "/kompetensi"}
          aksen={perluKompetensi ? "amber" : "emerald"}
        >
          <Batang
            className="mt-2"
            bagian={[
              { n: lengkap, kelas: "bg-emerald-500", label: "lengkap" },
              { n: perluKompetensi, kelas: "bg-amber-400", label: "perlu dilengkapi" },
            ]}
          />
        </Stat>
        <Stat
          icon="M4 5.5h1.5M4 10h1.5M4 14.5h1.5M8.5 5.5h7.5M8.5 10h7.5M8.5 14.5h7.5"
          label="Indikator perilaku"
          value={<Hitung n={indikator} />}
          hint={`${fmt(jumlahLevel)} deskripsi level · ±${kompetensi ? Math.round(indikator / kompetensi) : 0} per kompetensi`}
        />
        <Stat
          icon="M7.5 3.5h5v4h-5zM3 13h5v3.5H3zM12 13h5v3.5h-5zM10 7.5V10M5.5 13v-3h9v3"
          label="Jabatan"
          value={<Hitung n={jabatan.length} />}
          hint={`${perKelompok.get("Pelaksana") ?? 0} pelaksana · ${kelompok.length} kelompok`}
          href="/jabatan"
        />
        <Stat
          icon="M3.5 3.5h13v13h-13zM3.5 8h13M3.5 12.5h13M8 3.5v13M12.5 3.5v13"
          label="Pemetaan kompetensi"
          value={<Hitung n={pemetaan} />}
          hint={`rata-rata ${terpetakan ? (pemetaan / terpetakan).toFixed(1).replace(".", ",") : 0} per jabatan`}
          href="/matriks"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Kompetensi per bidang" className="xl:col-span-2" action={<Link href="/kompetensi" className="link text-xs">Lihat kamus →</Link>}>
          {/* kategori berisi satu bidang (inti, kepemimpinan) berbagi satu baris; sisanya selebar kartu */}
          <div className="grid gap-x-3 gap-y-5 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {perKategori.map(({ k, bs }) => (
              <section key={k} className={bs.length > 1 ? "sm:col-span-2 lg:col-span-3" : ""}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {KATEGORI_LABEL[k]}
                  <span className="h-px flex-1 bg-slate-100" aria-hidden />
                  <span className="font-normal normal-case tracking-normal text-slate-400">{bs.length} bidang</span>
                </h3>
                <div className={`grid gap-3 ${bs.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
                  {bs.map((b, i) => (
                    <KartuBidang key={b.kode} b={b} maxK={maxK} urutan={i} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Jabatan per kelompok" action={<Link href="/jabatan" className="link text-xs">Daftar →</Link>}>
            <ul className="space-y-3 p-4 text-sm">
              {kelompok.map(([k, n]) => (
                <li key={k}>
                  <Link href={`/jabatan?${new URLSearchParams({ kelompok: k })}`} className="group block">
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="text-slate-800 group-hover:text-brand-700">{k}</span>
                      <span className="tabular-nums text-slate-600">
                        {n} <span className="text-xs text-slate-400">· {Math.round((n / jabatan.length) * 100)}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 origin-left animate-[tumbuh_0.8s_ease-out_both] rounded-full bg-gradient-to-r from-brand-700 to-brand-400"
                        style={{ width: `${(n / kelompok[0][1]) * 100}%` }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Rata-rata indikator per level">
            <div className="px-4 pb-4 pt-5">
              <div className="relative flex h-36 items-end gap-3">
                {/* garis bantu 25/50/75/100% dari nilai tertinggi */}
                {[25, 50, 75, 100].map((p) => (
                  <div key={p} className="absolute inset-x-0 border-t border-dashed border-slate-100" style={{ bottom: `${p}%` }} aria-hidden />
                ))}
                {levels.map((l, i) => (
                  <div key={l.level} className="relative flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs font-medium tabular-nums text-slate-700">{(l.rata_indikator ?? 0).toFixed(2).replace(".", ",")}</span>
                    <div
                      className={`${LEVEL_KELAS[i] ?? "lv3"} w-full origin-bottom animate-[naik_0.7s_ease-out_both] rounded-t-md`}
                      style={{ height: `${((l.rata_indikator ?? 0) / maxAvg) * 80}%`, animationDelay: `${i * 80}ms` }}
                      title={`Level ${l.level}: ${fmt(l.jumlah_level)} deskripsi`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-3 border-t border-slate-200 pt-2">
                {levels.map((l) => (
                  <div key={l.level} className="flex-1 text-center leading-tight">
                    <div className="text-xs font-semibold text-slate-700">L{l.level}</div>
                    <div className="text-[11px] text-slate-500">{l.nama_level ?? LEVEL_NAMA[(l.level ?? 1) - 1]}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <DaftarTugas belum={belum} tanpaJobdesk={tanpaJobdesk} tanpaKompetensi={tanpaKompetensi} baganPerUnit={baganPerUnit} jumlahBagan={bagan.length} />
    </div>
  );
}

function Hero({
  total,
  lengkap,
  berJobdesk,
  terpetakan,
  sisaJabatan,
  sisaBagan,
  className = "",
}: {
  total: number;
  lengkap: number;
  berJobdesk: number;
  terpetakan: number;
  sisaJabatan: number;
  sisaBagan: number;
  className?: string;
}) {
  const persen = total ? Math.round((lengkap / total) * 100) : 0;
  const selesai = sisaJabatan === 0 && sisaBagan === 0;
  const r = 52;
  const keliling = 2 * Math.PI * r;
  return (
    <section
      className={`relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900 ${className}`}
      aria-label="Progres pemetaan jabatan"
    >
      {/* cahaya dekoratif */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative size-36 shrink-0 self-center">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/10" />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="url(#hero-ring)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={keliling}
              strokeDashoffset={keliling * (1 - persen / 100)}
              className="animate-[lingkar_1.1s_ease-out_both]"
              style={{ "--penuh": keliling } as React.CSSProperties}
            />
            <defs>
              <linearGradient id="hero-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--color-amber-300)" />
                <stop offset="100%" stopColor="var(--color-amber-500)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-heading text-3xl font-semibold tabular-nums">
                <Hitung n={persen} akhiran="%" />
              </div>
              <div className="text-[11px] uppercase tracking-wide text-brand-200">lengkap</div>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Progres pemetaan jabatan</div>
          <p className="mt-1.5 font-heading text-xl font-medium leading-snug text-white">
            {selesai ? (
              <>Semua {total} jabatan sudah punya jobdesk dan kompetensi.</>
            ) : (
              <>
                {lengkap} dari {total} jabatan sudah lengkap
                <span className="text-brand-200">
                  {" "}
                  — tersisa {sisaJabatan} jabatan{sisaBagan ? ` dan ${sisaBagan} kotak bagan` : ""}.
                </span>
              </>
            )}
          </p>

          <div className="mt-4 space-y-2.5">
            <HeroBar label="Punya jobdesk" n={berJobdesk} total={total} />
            <HeroBar label="Punya kompetensi" n={terpetakan} total={total} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {!selesai && (
              <a href="#belum-terpetakan" className="btn h-9 bg-amber-400 text-[13px] text-brand-950 shadow-sm hover:bg-amber-300">
                Lengkapi sekarang →
              </a>
            )}
            <Link href="/matriks" className="btn h-9 bg-white/10 text-[13px] text-white ring-1 ring-white/15 hover:bg-white/15">
              Lihat matriks
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroBar({ label, n, total }: { label: string; n: number; total: number }) {
  const p = total ? (n / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-brand-100">{label}</span>
        <span className="tabular-nums text-brand-200">
          {n}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-1.5 origin-left animate-[tumbuh_0.9s_ease-out_both] rounded-full bg-gradient-to-r from-brand-400 to-brand-200" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function AksesCepat({ info, review }: { info: Record<string, string>; review: { n: Record<string, number>; total: number } }) {
  const tujuan = MENU.filter((m) => m.href in info);
  return (
    <Card title="Akses cepat">
      <ul className="divide-y divide-slate-100">
        {tujuan.map((m) => (
          <li key={m.href}>
            <Link href={m.href} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-colors group-hover:bg-brand-700 group-hover:text-white">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-5" aria-hidden>
                  <path d={m.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{m.label}</span>
                <span className="block truncate text-xs text-slate-500">{info[m.href]}</span>
                {m.href === "/review" && review.total > 0 && (
                  <Batang
                    className="mt-1.5"
                    bagian={REVIEW_STATUS.map((s) => ({ n: review.n[s], kelas: REVIEW_BAR[s], label: REVIEW_LABEL[s].toLowerCase() }))}
                  />
                )}
              </span>
              <span className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type BidangRow = { kode: string | null; nama: string | null; jumlah_kompetensi: number | null; jumlah_lengkap: number | null; jumlah_indikator: number | null; jumlah_perlu_tindak_lanjut: number | null };

function KartuBidang({ b, maxK, urutan }: { b: BidangRow; maxK: number; urutan: number }) {
  const n = b.jumlah_kompetensi ?? 0;
  const perlu = b.jumlah_perlu_tindak_lanjut ?? 0;
  const p = n ? (b.jumlah_lengkap ?? 0) / n : 0;
  const r = 14;
  const keliling = 2 * Math.PI * r;
  return (
    <div
      className="group relative animate-[masuk_0.45s_ease-out_both] rounded-xl border border-slate-200 bg-white p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
      style={{ animationDelay: `${Math.min(urutan, 12) * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-100">{b.kode}</span>
        {perlu > 0 && (
          <Link
            href={`/kompetensi?bidang=${b.kode}&fokus=perlu`}
            className="relative z-10 ml-auto whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
            title="Kompetensi berstatus selain Lengkap"
          >
            {perlu} perlu dilengkapi
          </Link>
        )}
        <svg viewBox="0 0 36 36" className="size-8 -rotate-90" role="img" aria-label={`${Math.round(p * 100)}% lengkap`}>
          <title>{`${b.jumlah_lengkap ?? 0} dari ${n} kompetensi lengkap`}</title>
          <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-slate-100" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={keliling}
            strokeDashoffset={keliling * (1 - p)}
            className={`animate-[lingkar_1s_ease-out_both] ${p === 1 ? "stroke-emerald-500" : "stroke-amber-400"}`}
            style={{ "--penuh": keliling } as React.CSSProperties}
          />
        </svg>
      </div>
      {/* stretched link: seluruh kartu bisa diklik, badge "perlu dilengkapi" tetap punya tautannya sendiri */}
      <Link href={`/kompetensi?bidang=${b.kode}`} className="mt-1.5 line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-slate-900 after:absolute after:inset-0 after:rounded-xl group-hover:text-brand-700">
        {b.nama}
      </Link>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-1.5 origin-left animate-[tumbuh_0.8s_ease-out_both] rounded-full bg-gradient-to-r from-brand-700 to-brand-400" style={{ width: `${(n / maxK) * 100}%` }} />
      </div>
      <div className="mt-2 flex items-center gap-2 whitespace-nowrap text-xs text-slate-500">
        <span>
          <span className="font-semibold tabular-nums text-slate-800">{n}</span> kompetensi
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{fmt(b.jumlah_indikator)} indikator</span>
      </div>
    </div>
  );
}

type JabatanBelum = { kode: string | null; nama: string | null; unit_induk_nama: string | null; ikhtisar_jabatan: string | null; jumlah_kompetensi: number | null };

function DaftarTugas({
  belum,
  tanpaJobdesk,
  tanpaKompetensi,
  baganPerUnit,
  jumlahBagan,
}: {
  belum: JabatanBelum[];
  tanpaJobdesk: number;
  tanpaKompetensi: number;
  baganPerUnit: Map<string, string[]>;
  jumlahBagan: number;
}) {
  const perUnit = new Map<string, JabatanBelum[]>();
  for (const j of belum) perUnit.set(j.unit_induk_nama ?? "-", [...(perUnit.get(j.unit_induk_nama ?? "-") ?? []), j]);
  // grup unit yang dimulai setelah BATAS_TAMPIL baris disembunyikan di balik "Lihat semua"
  let hitung = 0;
  const grup = [...perUnit].map(([unit, js]) => {
    const tampil = hitung < BATAS_TAMPIL;
    hitung += js.length;
    return { unit, js, tampil };
  });
  const unitBagan = [...baganPerUnit];

  const chip = "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors";
  return (
    <Card
      title="Daftar tugas pemetaan"
      action={
        <Link href="/jabatan?kelengkapan=belum" className="link text-xs">
          Buka di Daftar Jabatan →
        </Link>
      }
    >
      <div id="belum-terpetakan" className="scroll-mt-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Link href="/jabatan?kelengkapan=tanpa-jobdesk" className={`${chip} bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100`}>
            {tanpaJobdesk} tanpa jobdesk
          </Link>
          <Link href="/jabatan?kelengkapan=tanpa-kompetensi" className={`${chip} bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100`}>
            {tanpaKompetensi} tanpa kompetensi
          </Link>
          <a href="#bagan-tanpa-jobdesk" className={`${chip} bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100`}>
            {jumlahBagan} kotak bagan
          </a>
        </div>

        <div className="grid divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div>
            <h3 className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Jabatan tanpa jobdesk / kompetensi</h3>
            {belum.length ? (
              <>
                {grup.filter((g) => g.tampil).map((g) => <GrupJabatan key={g.unit} {...g} />)}
                {grup.some((g) => !g.tampil) && (
                  <details className="group/lagi">
                    <summary className="list-none px-4 py-2.5 text-xs font-semibold text-brand-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                      <span className="group-open/lagi:hidden">Lihat {belum.length - grup.filter((g) => g.tampil).reduce((s, g) => s + g.js.length, 0)} jabatan lainnya ↓</span>
                      <span className="hidden group-open/lagi:inline">Sembunyikan ↑</span>
                    </summary>
                    {grup.filter((g) => !g.tampil).map((g) => <GrupJabatan key={g.unit} {...g} />)}
                  </details>
                )}
              </>
            ) : (
              <Beres>Semua jabatan sudah punya jobdesk dan kompetensi.</Beres>
            )}
          </div>

          <div id="bagan-tanpa-jobdesk" className="scroll-mt-6">
            <h3 className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Ada di bagan, belum ada dokumen jobdesk</h3>
            {unitBagan.length ? (
              <>
                <ul className="divide-y divide-slate-50 text-sm">
                  {unitBagan.map(([unit, labels]) => (
                    <li key={unit} className="px-4 py-2.5">
                      <div className="text-xs font-medium text-slate-600">{unit}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {labels.map((l) => (
                          <Link
                            key={l}
                            href={`/jabatan/baru?${new URLSearchParams({ nama: l, unit })}`}
                            title="Buat jabatan ini"
                            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-100"
                          >
                            {l}
                            <span className="text-amber-600" aria-hidden>
                              +
                            </span>
                          </Link>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                  Belum menjadi jabatan di database — klik untuk membuatnya. Sebagian mungkin hanya beda penamaan dengan jobdesk yang ada (mis. &quot;DC &amp; DRC&quot;, &quot;HCIS&quot;) — perlu dicek HC.
                </p>
              </>
            ) : (
              <Beres>Semua kotak bagan sudah punya dokumen jobdesk.</Beres>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function GrupJabatan({ unit, js }: { unit: string; js: JabatanBelum[] }) {
  return (
    <div className="pb-1">
      <div className="flex items-center gap-2 px-4 pt-2 text-xs font-medium text-slate-600">
        {unit}
        <span className="rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-500">{js.length}</span>
      </div>
      <ul className="text-sm">
        {js.map((j) => (
          <li key={j.kode}>
            <Link href={`/jabatan/${j.kode}`} className="group flex flex-wrap items-center gap-2 px-4 py-1.5 hover:bg-slate-50">
              <span className="size-1.5 rounded-full bg-rose-400" aria-hidden />
              <span className="font-medium text-slate-900 group-hover:text-brand-700">{j.nama}</span>
              <span className="ml-auto flex gap-1">
                {!j.ikhtisar_jabatan && <Gap>tanpa jobdesk</Gap>}
                {!j.jumlah_kompetensi && <Gap>tanpa kompetensi</Gap>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Beres({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="size-6" aria-hidden>
          <path d="m5 10.5 3.2 3L15 6.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <p className="text-sm font-semibold text-slate-800">Semua beres 🎉</p>
      <p className="text-xs text-slate-500">{children}</p>
    </div>
  );
}

function Gap({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">{children}</span>;
}

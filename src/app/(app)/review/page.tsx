import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Hitung } from "@/components/hitung";
import { DashboardSkeleton } from "@/components/skeleton";
import { Card, PageHeader, ReviewBadge, Stat } from "@/components/ui";
import { penggunaSaatIni } from "@/lib/auth";
import { JENJANG_LABEL, REVIEW_BAR, REVIEW_LABEL, REVIEW_STATUS, fmt } from "@/lib/labels";
import { bolehEdit } from "@/lib/peran";
import { must, supabase } from "@/lib/supabase";

export const metadata: Metadata = { title: "Progres Review" };

const AKSI: Record<string, string> = {
  ubah_status: "mengubah status",
  simpan_jobdesk: "menyimpan jobdesk",
  simpan_kompetensi: "menyimpan kompetensi",
  simpan_jabatan: "menyimpan data jabatan",
  buat_jabatan: "membuat jabatan",
  selesai_massal: "menandai selesai (massal)",
};

const HARI = 24 * 60 * 60 * 1000;
const MINGGU = 8; // rentang grafik aktivitas
const LAJU_HARI = 28; // jendela untuk menghitung laju penyelesaian
const TZ = "Asia/Makassar"; // Bank Sultra berada di zona WITA

const persen = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const tanggal = (d: Date, opsi: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => d.toLocaleDateString("id-ID", { ...opsi, timeZone: TZ });

export default function Page() {
  return (
    <>
      <PageHeader
        title="Progres Review"
        desc="Kemajuan konsultan menuntaskan pemetaan jabatan–kompetensi: Draf → Selesai, lalu diserahkan ke Divisi HC. Direksi tidak termasuk."
      >
        <Link href="/jabatan?review=draf" className="btn-primary">
          Kerjakan jabatan draf →
        </Link>
      </PageHeader>
      <Suspense fallback={<DashboardSkeleton label="Memuat progres review" />}>
        <Progres />
      </Suspense>
    </>
  );
}

async function Progres() {
  await connection(); // umur antrean & laju dihitung dari waktu sekarang
  const sekarang = new Date().getTime();
  const sejak = new Date(sekarang - MINGGU * 7 * HARI).toISOString();
  const [jabatan, riwayat, aktivitas, saya] = await Promise.all([
    supabase.from("v_review_jabatan").select("*").order("urutan").then(must),
    supabase
      .from("review_riwayat")
      .select("id, jabatan_id, aksi, status_dari, status_ke, peninjau, created_at")
      .gte("created_at", sejak)
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(must),
    supabase
      .from("review_riwayat")
      .select("id, aksi, status_dari, status_ke, peninjau, catatan, created_at, jabatan(kode, nama)")
      .order("created_at", { ascending: false })
      .limit(12)
      .then(must),
    penggunaSaatIni(),
  ]);
  const bolehTandai = bolehEdit(saya?.peran);

  const hitung = (xs: typeof jabatan) => Object.fromEntries(REVIEW_STATUS.map((s) => [s, xs.filter((j) => j.status === s).length])) as Record<string, number>;
  const total = hitung(jabatan);
  const sisa = total.draf;

  // ---- laju: penandaan selesai dalam LAJU_HARI terakhir → perkiraan tanggal tuntas
  const jadiSelesai = (r: { status_dari: string | null; status_ke: string | null }) => r.status_ke === "selesai" && r.status_dari !== "selesai";
  const selesaiBaru = riwayat.filter((r) => jadiSelesai(r) && sekarang - Date.parse(r.created_at) <= LAJU_HARI * HARI);
  const lajuHarian = selesaiBaru.length / LAJU_HARI;
  const eta = lajuHarian > 0 && sisa > 0 ? new Date(sekarang + (sisa / lajuHarian) * HARI) : null;
  const aktif7 = riwayat.filter((r) => sekarang - Date.parse(r.created_at) <= 7 * HARI);
  const peninjauAktif7 = new Set(aktif7.map((r) => r.peninjau ?? "Tanpa nama")).size;

  // ---- aktivitas per minggu (indeks 0 = minggu terlama)
  const mingguan = Array.from({ length: MINGGU }, (_, i) => {
    const akhir = sekarang - (MINGGU - 1 - i) * 7 * HARI;
    const awal = akhir - 7 * HARI;
    const rs = riwayat.filter((r) => {
      const t = Date.parse(r.created_at);
      return t > awal && t <= akhir;
    });
    return { label: tanggal(new Date(awal + HARI)), aksi: rs.length, setuju: rs.filter(jadiSelesai).length };
  });

  // ---- peninjau
  const peninjau = [
    ...riwayat
      .reduce((m, r) => {
        const nama = r.peninjau ?? "Tanpa nama";
        const p = m.get(nama) ?? { nama, aksi: 0, jabatan: new Set<number>(), setuju: 0, terakhir: r.created_at };
        p.aksi++;
        p.jabatan.add(r.jabatan_id);
        if (jadiSelesai(r)) p.setuju++;
        if (r.created_at > p.terakhir) p.terakhir = r.created_at;
        return m.set(nama, p);
      }, new Map<string, { nama: string; aksi: number; jabatan: Set<number>; setuju: number; terakhir: string }>())
      .values(),
  ].sort((a, b) => b.aksi - a.aksi);

  // ---- antrean draf: yang dibuka kembali setelah selesai (punya baris review, terlama di atas) & yang belum pernah selesai
  const umur = (j: (typeof jabatan)[number]) => (j.updated_at ? Math.floor((sekarang - Date.parse(j.updated_at)) / HARI) : null);
  const draf = jabatan.filter((j) => j.status === "draf").map((j) => ({ j, hari: umur(j) }));
  const dibukaKembali = draf.filter((d) => d.hari !== null).sort((a, b) => b.hari! - a.hari!);
  const belumSelesai = draf.filter((d) => d.hari === null);

  // ---- per jenjang & per unit
  const perJenjang = [1, 2, 3, 4].map((jj) => {
    const js = jabatan.filter((j) => j.jenjang === jj);
    return { jj, total: js.length, n: hitung(js) };
  }).filter((x) => x.total);
  const perUnit = groupBy(jabatan, (j) => j.unit_induk_nama ?? "-").map(([unit, js]) => ({ unit, total: js.length, n: hitung(js) }));
  // hampir tuntas: sudah ada yang selesai, sisa paling sedikit — cepat dituntaskan
  const hampir = perUnit
    .filter((u) => u.n.selesai > 0 && u.n.selesai < u.total)
    .sort((a, b) => a.total - a.n.selesai - (b.total - b.n.selesai))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <Hero total={jabatan.length} n={total} eta={eta} lajuMinggu={lajuHarian * 7} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon="M4.5 10.5l3.5 3.5 7.5-8"
          label="Selesai"
          value={<Hitung n={persen(total.selesai, jabatan.length)} akhiran="%" />}
          hint={`${fmt(total.selesai)} dari ${fmt(jabatan.length)} jabatan final`}
          href="/jabatan?review=selesai"
          aksen={total.selesai === jabatan.length ? "emerald" : "brand"}
        />
        <Stat
          icon="M3 10s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5zM10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
          label="Masih draf"
          value={<Hitung n={total.draf} />}
          hint={dibukaKembali.length ? `${fmt(dibukaKembali.length)} di antaranya dibuka kembali setelah selesai` : "jabatan belum ditandai selesai"}
          href="/jabatan?review=draf"
          aksen={total.draf ? "amber" : "emerald"}
        />
        <Stat
          icon="M3.5 16.5h13M6 13.5V9M10 13.5V5M14 13.5v-6"
          label="Aktivitas 7 hari"
          value={<Hitung n={aktif7.length} />}
          hint={aktif7.length ? `${peninjauAktif7} peninjau aktif` : "Belum ada aktivitas minggu ini"}
        />
        <Stat
          icon="M4 4.5h12v12H4zM4 8h12M7.5 3v3M12.5 3v3"
          label="Perkiraan selesai"
          value={sisa === 0 ? "Selesai" : eta ? tanggal(eta, { day: "numeric", month: "short", year: "2-digit" }) : "—"}
          hint={sisa === 0 ? "Semua jabatan selesai" : eta ? `Laju ${lajuHarian * 7 >= 1 ? Math.round(lajuHarian * 7) : "<1"} jabatan selesai/minggu` : `Belum ada jabatan selesai dalam ${LAJU_HARI} hari terakhir`}
          aksen={sisa === 0 ? "emerald" : "brand"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={`Aktivitas ${MINGGU} minggu terakhir`} className="xl:col-span-2">
          <Mingguan data={mingguan} />
        </Card>
        <Card title="Peninjau">
          {peninjau.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500">Belum ada peninjau dalam {MINGGU} minggu terakhir.</p>
          ) : (
            <ul className="divide-y divide-slate-50 text-sm">
              {peninjau.slice(0, 8).map((p, i) => (
                <li key={p.nama} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${i === 0 ? "bg-amber-400 text-brand-950" : "bg-brand-50 text-brand-700 ring-1 ring-brand-100"}`}
                    aria-hidden
                  >
                    {p.nama.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">{p.nama}</span>
                    <span className="block text-xs text-slate-500">
                      {p.jabatan.size} jabatan · {p.setuju} selesai · terakhir {tanggal(new Date(p.terakhir))}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-700">{p.aksi}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Antrean tindakan" className="xl:col-span-2">
          <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
            <Antrean judul="Dibuka kembali" desc="diedit setelah selesai, perlu ditandai ulang" items={dibukaKembali} status="draf" />
            <Antrean
              judul="Belum selesai"
              desc="urut struktur organisasi"
              items={belumSelesai}
              status="draf"
              aksi={
                bolehTandai && draf.length > 1 ? (
                  <Link href="/review/selesai" className="link text-xs">
                    Tandai selesai massal →
                  </Link>
                ) : null
              }
            />
          </div>
        </Card>
        <Card title="Per jenjang">
          <ul className="space-y-4 p-4 text-sm">
            {perJenjang.map(({ jj, total: t, n }) => (
              <li key={jj}>
                <div className="mb-1.5 flex justify-between gap-2">
                  <span className="text-slate-800">{JENJANG_LABEL[jj]}</span>
                  <span className="tabular-nums text-slate-600">
                    <b className="text-slate-900">{n.selesai}</b>/{t}
                  </span>
                </div>
                <Bar n={n} total={t} className="h-2.5" />
              </li>
            ))}
          </ul>
          <Legenda />
        </Card>
      </div>

      <Card
        title="Peta progres per divisi / kantor"
        action={<span className="text-xs text-slate-500">Warna kartu = porsi selesai</span>}
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {perUnit.map(({ unit, total: t, n }, i) => {
            const p = persen(n.selesai, t);
            return (
              <div
                key={unit}
                className="relative animate-[masuk_0.45s_ease-out_both] overflow-hidden rounded-xl border border-slate-200 p-3.5"
                style={{ background: `color-mix(in oklab, var(--color-emerald-100) ${p}%, white)`, animationDelay: `${Math.min(i, 12) * 30}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-snug text-slate-900">{unit}</span>
                  <span className="font-heading text-lg font-semibold tabular-nums text-slate-900">{p}%</span>
                </div>
                <div className="mb-2 mt-0.5 text-xs text-slate-500">
                  {t} jabatan · {n.draf} draf
                </div>
                <Bar n={n} total={t} className="h-1.5" />
              </div>
            );
          })}
        </div>
        {hampir.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-emerald-50/50 px-4 py-3 text-sm">
            <span className="font-semibold text-emerald-900">Hampir tuntas:</span>
            {hampir.map((u) => (
              <span key={u.unit} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-700 ring-1 ring-emerald-200">
                {u.unit} <b className="tabular-nums text-emerald-800">sisa {u.total - u.n.selesai}</b>
              </span>
            ))}
          </div>
        )}
        <Legenda />
      </Card>

      <Card title="Aktivitas terbaru">
        {aktivitas.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">Belum ada aktivitas review. Mulai dari tombol &quot;Tinjau jabatan berikutnya&quot; di atas.</p>
        ) : (
          <ol className="relative mx-4 my-4 space-y-4 border-l border-slate-200 pl-5 text-sm">
            {aktivitas.map((a) => (
              <li key={a.id}>
                <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-white bg-brand-500" aria-hidden />
                <div className="text-slate-800">
                  <b>{a.peninjau ?? "Tanpa nama"}</b> {AKSI[a.aksi] ?? a.aksi}{" "}
                  <Link href={`/jabatan/${a.jabatan?.kode}#review`} className="text-brand-700 hover:underline">
                    {a.jabatan?.nama}
                  </Link>
                  {a.status_ke && a.status_dari !== a.status_ke && (
                    <>
                      {" "}
                      · <ReviewBadge status={a.status_dari} /> → <ReviewBadge status={a.status_ke} />
                    </>
                  )}
                </div>
                {a.catatan && <div className="mt-0.5 text-slate-600">{a.catatan}</div>}
                <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: TZ })}</div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function Hero({ total, n, eta, lajuMinggu }: { total: number; n: Record<string, number>; eta: Date | null; lajuMinggu: number }) {
  const p = persen(n.selesai, total);
  const r = 52;
  const keliling = 2 * Math.PI * r;
  const sisa = total - n.selesai;
  // alur: draf (dikerjakan konsultan) → selesai (diserahkan ke Divisi HC)
  const tahap = [
    { s: "draf", ket: "dikerjakan konsultan" },
    { s: "selesai", ket: "siap diserahkan ke HC" },
  ];
  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900" aria-label="Ringkasan progres review">
      {/* cahaya dekoratif */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />

      <div className="relative grid gap-8 lg:grid-cols-5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center lg:col-span-2">
          <div className="relative size-36 shrink-0 self-center">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/10" />
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke="url(#review-ring)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={keliling}
                strokeDashoffset={keliling * (1 - p / 100)}
                className="animate-[lingkar_1.1s_ease-out_both]"
                style={{ "--penuh": keliling } as React.CSSProperties}
              />
              <defs>
                <linearGradient id="review-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--color-emerald-300)" />
                  <stop offset="100%" stopColor="var(--color-emerald-500)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="font-heading text-3xl font-semibold tabular-nums">
                  <Hitung n={p} akhiran="%" />
                </div>
                <div className="text-[11px] uppercase tracking-wide text-brand-200">selesai</div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Progres review</div>
            <p className="mt-1.5 font-heading text-xl font-medium leading-snug">
              {sisa === 0 ? (
                <>Semua {fmt(total)} jabatan sudah selesai dan siap diserahkan ke Divisi HC.</>
              ) : (
                <>
                  {fmt(n.selesai)} dari {fmt(total)} jabatan final
                  <span className="text-brand-200">
                    {eta
                      ? ` — dengan laju ${lajuMinggu >= 1 ? Math.round(lajuMinggu) : "<1"}/minggu, selesai sekitar ${tanggal(eta, { day: "numeric", month: "long", year: "numeric" })}.`
                      : n.selesai
                        ? ` — tersisa ${fmt(sisa)} jabatan.`
                        : " — belum ada yang ditandai selesai."}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="content-center lg:col-span-3">
          <ol className="grid grid-cols-2 gap-2" aria-label="Alur review">
            {tahap.map(({ s, ket }, i) => (
              <li key={s} className="relative">
                <Link
                  href={`/jabatan?review=${s}`}
                  className="block animate-[masuk_0.45s_ease-out_both] rounded-xl bg-white/[0.06] p-3.5 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                  style={{ animationDelay: `${150 + i * 80}ms` }}
                >
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-200">
                    <span className={`size-2 rounded-full ${REVIEW_BAR[s]}`} aria-hidden />
                    {REVIEW_LABEL[s]}
                  </span>
                  <span className="mt-1 block font-heading text-3xl font-semibold tabular-nums">{n[s]}</span>
                  <span className="text-xs text-brand-300">
                    {ket} · {persen(n[s], total)}%
                  </span>
                </Link>
                {i < tahap.length - 1 && (
                  <span className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-brand-300 sm:block" aria-hidden>
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
          {/* corong: lebar tiap batang sebanding jumlah jabatan di tahap itu */}
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={REVIEW_STATUS.map((s) => `${REVIEW_LABEL[s]} ${n[s]}`).join(", ")}>
            {[...REVIEW_STATUS].reverse().map((s) => n[s] > 0 && <span key={s} className={`block origin-left animate-[tumbuh_0.9s_ease-out_both] ${REVIEW_BAR[s]}`} style={{ width: `${(n[s] / Math.max(total, 1)) * 100}%` }} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

function Mingguan({ data }: { data: { label: string; aksi: number; setuju: number }[] }) {
  const maxN = Math.max(1, ...data.map((d) => d.aksi));
  const kosong = data.every((d) => !d.aksi);
  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-300" aria-hidden />
          Semua aksi (ubah status, edit jobdesk/kompetensi)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-500" aria-hidden />
          Ditandai selesai
        </span>
      </div>
      <div className="relative flex h-44 items-end gap-3">
        {[25, 50, 75, 100].map((p) => (
          <div key={p} className="absolute inset-x-0 border-t border-dashed border-slate-100" style={{ bottom: `${p * 0.85}%` }} aria-hidden />
        ))}
        {kosong && <p className="absolute inset-0 grid place-items-center text-sm text-slate-400">Belum ada aktivitas review dalam {data.length} minggu terakhir.</p>}
        {data.map((d, i) => (
          <div key={i} className="relative flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Minggu ${d.label}: ${d.aksi} aksi, ${d.setuju} ditandai selesai`}>
            {d.aksi > 0 && <span className="text-xs font-medium tabular-nums text-slate-700">{d.aksi}</span>}
            <div className="relative w-full max-w-12 origin-bottom animate-[naik_0.7s_ease-out_both] overflow-hidden rounded-t-md bg-brand-300" style={{ height: `${(d.aksi / maxN) * 85}%`, animationDelay: `${i * 60}ms` }}>
              <div className="absolute inset-x-0 bottom-0 bg-emerald-500" style={{ height: `${d.aksi ? (d.setuju / d.aksi) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 border-t border-slate-200 pt-2">
        {data.map((d, i) => (
          <span key={i} className={`flex-1 text-center text-[11px] ${i === data.length - 1 ? "font-semibold text-slate-700" : "text-slate-500"}`}>
            {i === data.length - 1 ? "Minggu ini" : d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Antrean({
  judul,
  desc,
  items,
  status,
  aksi,
}: {
  judul: string;
  desc: string;
  items: { j: { jabatan_id: number | null; kode: string | null; nama: string | null; unit_induk_nama: string | null; catatan: string | null; peninjau: string | null }; hari: number | null }[];
  status: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{judul}</h3>
          <p className="text-xs text-slate-400">{desc}</p>
        </div>
        <span className="flex items-center gap-3">
          {aksi}
          <ReviewBadge status={status} />
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-slate-500">Kosong.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-slate-50 overflow-auto text-sm">
          {items.map(({ j, hari }) => (
            <li key={j.jabatan_id}>
              <Link href={`/jabatan/${j.kode}#review`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{j.nama}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {j.unit_induk_nama}
                    {j.catatan ? ` · ${j.catatan}` : j.peninjau ? ` · oleh ${j.peninjau}` : ""}
                  </span>
                </span>
                {hari !== null && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset ${
                      hari >= 14 ? "bg-rose-50 text-rose-700 ring-rose-200" : hari >= 7 ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-50 text-slate-600 ring-slate-200"
                    }`}
                    title="Hari sejak status terakhir diubah"
                  >
                    {hari ? `${hari} hari` : "hari ini"}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Legenda() {
  return (
    <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-600">
      {REVIEW_STATUS.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-sm ${REVIEW_BAR[s]}`} aria-hidden />
          {REVIEW_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

/** Stacked bar of review statuses. */
function Bar({ n, total, className = "" }: { n: Record<string, number>; total: number; className?: string }) {
  return (
    <div className={`flex overflow-hidden rounded-full bg-slate-100 ${className}`} role="img" aria-label={REVIEW_STATUS.map((s) => `${REVIEW_LABEL[s]} ${n[s]}`).join(", ")}>
      {[...REVIEW_STATUS]
        .reverse()
        .map((s) => n[s] > 0 && <div key={s} className={REVIEW_BAR[s]} style={{ width: `${(n[s] / Math.max(total, 1)) * 100}%` }} title={`${REVIEW_LABEL[s]}: ${n[s]}`} />)}
    </div>
  );
}

function groupBy<T>(xs: T[], key: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m];
}

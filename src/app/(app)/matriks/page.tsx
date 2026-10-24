import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Empty, PageHeader } from "@/components/ui";
import { MatriksSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { JENJANG_LABEL, KATEGORI_LABEL, LEVEL_NAMA, fmt } from "@/lib/labels";
import { loadMatriks, loadUnits, type Matriks } from "@/lib/matriks";

export const metadata: Metadata = { title: "Matriks Kompetensi" };

type Search = { unit?: string; kategori?: string; q?: string; kolom?: string };

export default function Page(props: PageProps<"/matriks">) {
  return (
    <>
      <PageHeader title="Matriks Kompetensi" desc="Jabatan (baris) × kompetensi (kolom). Angka di sel = level target kompetensi untuk jabatan tersebut. Ringkasan di atas tabel mengikuti pilihan unit, kategori, dan pencarian." />
      <Suspense fallback={<MatriksSkeleton />}>
        <Matriks searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function Matriks({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const kategori = sp.kategori ?? "";
  const units = await loadUnits();
  const q = (sp.q ?? "").trim();
  // tanpa pilihan unit: cari di semua unit bila ada kata kunci, kalau tidak tampilkan unit pertama
  const unit = sp.unit ?? (q ? "semua" : (units[0] ?? ""));
  const semua = unit === "semua";
  const kolom = sp.kolom === "umum" ? "umum" : "kode";
  const m = await loadMatriks(semua ? "" : unit, kategori, q);
  const ins = hitungInsight(m);
  // urutan "umum": kompetensi yang dipakai paling banyak jabatan di kiri, tetap dikelompokkan per kategori
  if (kolom === "umum")
    m.kompetensi.sort(
      (a, b) => URUT_KATEGORI.indexOf(a.kategori) - URUT_KATEGORI.indexOf(b.kategori) || (ins.perKolom.get(b.kode) ?? 0) - (ins.perKolom.get(a.kode) ?? 0),
    );
  const unduh = (u: string, kunci = "") => `/matriks/unduh?${new URLSearchParams({ unit: u, kategori, ...(kunci && { q: kunci }) })}`;

  return (
    <div className="space-y-4">
      <Form action="" className="filter-bar">
        <label className="field-label min-w-56 flex-1">
          Cari jabatan
          <span className="relative">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <circle cx="9" cy="9" r="5.5" />
              <path d="m13 13 3.5 3.5" strokeLinecap="round" />
            </svg>
            <input type="search" name="q" defaultValue={q} placeholder="mis. Teller, Kepala Seksi, HC…" className="field w-full pl-9" />
          </span>
        </label>
        <label className="field-label min-w-56 flex-1">
          Divisi / kantor
          <select name="unit" defaultValue={unit} className="field">
            <option value="semua">Semua divisi / kantor</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Kategori kompetensi
          <select name="kategori" defaultValue={kategori} className="field">
            <option value="">Semua</option>
            {Object.entries(KATEGORI_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Urutan kolom
          <select name="kolom" defaultValue={kolom} className="field">
            <option value="kode">Kode kompetensi</option>
            <option value="umum">Paling umum dulu</option>
          </select>
        </label>
        <SubmitButton>Tampilkan</SubmitButton>
        {q && (
          <Link href={`/matriks?${new URLSearchParams({ unit: semua ? (units[0] ?? "") : unit, kategori, kolom })}`} className="btn-secondary">
            Hapus pencarian
          </Link>
        )}
      </Form>

      {m.jabatan.length > 0 && m.kompetensi.length > 0 && (
        <>
          <Hero
            judul={q ? `Hasil “${q}”` : semua ? "Semua divisi / kantor" : unit}
            sub={q ? (semua ? "di semua divisi/kantor" : `di ${unit}`) : kategori ? `kompetensi ${KATEGORI_LABEL[kategori]?.toLowerCase()}` : "semua kategori kompetensi"}
            m={m}
            ins={ins}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <KompetensiBersama m={m} ins={ins} />
            <LevelPerJenjang ins={ins} />
            <ProfilJabatan m={m} ins={ins} />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-xs text-slate-500">
          Angka di samping nama jabatan = jumlah kompetensi · rata-rata level. Baris bawah header = jumlah jabatan yang memakai kompetensi.
        </span>
        <span className="ml-auto text-xs text-slate-500">Unduh untuk Excel:</span>
        <a href={unduh(unit, q)} className="link">
          Tampilan ini (CSV)
        </a>
        <span className="text-slate-300" aria-hidden>
          ·
        </span>
        <a href={unduh("semua")} className="link">
          Semua jabatan (CSV)
        </a>
      </div>

      {m.jabatan.length === 0 || m.kompetensi.length === 0 ? (
        <Empty>{q ? `Tidak ada jabatan yang cocok dengan "${q}".` : "Belum ada pemetaan untuk pilihan ini."}</Empty>
      ) : (
        // tinggi kotak = tinggi layar (bukan 75vh) supaya baris tetap terlihat di layar kecil; scroll-pt menjaga baris
        // yang difokus tidak tertutup header kolom yang sticky
        <div className="max-h-[calc(100dvh-2rem)] scroll-pt-40 overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="matriks border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20 bg-white">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 min-w-44 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-medium text-slate-500"
                >
                  Jabatan
                </th>
                {groupBy(m.kompetensi, (k) => k.kategori).map(([kat, ks]) => (
                  <th
                    key={kat}
                    colSpan={ks.length}
                    className="border-b border-l border-slate-200 bg-slate-50 px-2 py-1 text-left font-medium uppercase tracking-wide text-slate-500"
                  >
                    {KATEGORI_LABEL[kat] ?? kat}
                  </th>
                ))}
              </tr>
              <tr>
                {m.kompetensi.map((k) => (
                  <th
                    key={k.kode}
                    title={`${k.kode} — ${k.nama}`}
                    className="h-32 border-b border-l border-slate-100 px-1 align-bottom text-[11px] leading-tight font-normal text-slate-600"
                  >
                    <Link
                      href={`/kompetensi/${k.kode}`}
                      className="inline-block max-h-28 overflow-hidden text-left [writing-mode:vertical-rl] rotate-180 hover:text-brand-700"
                    >
                      <span className="font-mono text-slate-500">{k.kode}</span> {k.nama}
                    </Link>
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-50 px-3 py-1 text-left text-[11px] font-medium text-slate-500">
                  Dipakai jabatan
                </th>
                {m.kompetensi.map((k) => {
                  const n = ins.perKolom.get(k.kode) ?? 0;
                  const penuh = n === m.jabatan.length;
                  return (
                    <th
                      key={k.kode}
                      title={`${n} dari ${m.jabatan.length} jabatan`}
                      className={`border-b border-l border-slate-200 px-0.5 py-1 text-[10px] font-semibold tabular-nums ${penuh ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-500"}`}
                    >
                      {n}
                    </th>
                  );
                })}
              </tr>
            </thead>
            {groupBy(m.jabatan, (j) => j.unit_induk_nama).map(([induk, js]) => (
              // Baris dirender sebagai satu string HTML: mode semua unit = ±64 ribu sel, dan sebagai elemen React
              // tiap sel ikut terkirim dua kali (HTML + payload RSC). Gaya sel ada di .matriks pada globals.css.
              <tbody key={induk} dangerouslySetInnerHTML={{ __html: barisHtml(induk, js, m, ins, semua) }} />
            ))}
          </table>
        </div>
      )}
    </div>
  );
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function barisHtml(induk: string, js: Matriks["jabatan"], m: Matriks, ins: Insight, semua: boolean) {
  const out: string[] = [];
  if (semua) {
    out.push(
      `<tr><th colspan="${m.kompetensi.length + 1}" class="border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-left">` +
        `<span class="sticky left-3 font-semibold text-slate-700">${esc(induk)}</span></th></tr>`,
    );
  }
  for (const j of js) {
    const gaya = j.jenjang <= 3 ? "font-medium text-slate-900" : "text-slate-700";
    out.push(
      `<tr><th class="sticky left-0 z-10 max-w-72 min-w-44 border-b border-r border-slate-100 bg-white px-3 py-1.5 text-left font-normal">` +
        `<span class="flex items-baseline gap-2"><a href="/jabatan/${encodeURIComponent(j.kode)}" class="min-w-0 flex-1 hover:underline ${gaya}" style="padding-left:${(j.jenjang - 1) * 0.75}rem">${esc(j.nama)}</a>` +
        `<span class="shrink-0 text-[10px] tabular-nums text-slate-400" title="jumlah kompetensi · rata-rata level">${ringkasBaris(ins.perBaris.get(j.id))}</span></span></th>`,
    );
    for (const k of m.kompetensi) {
      const lv = m.level.get(`${j.id}|${k.kode}`);
      out.push(lv ? `<td class="lv${lv}">${lv}</td>` : "<td></td>");
    }
    out.push("</tr>");
  }
  return out.join("");
}

function groupBy<T>(xs: T[], key: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m];
}

const URUT_KATEGORI = ["inti", "kepemimpinan", "teknis"];
const satuDesimal = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const persen = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

type Insight = ReturnType<typeof hitungInsight>;

/** Ringkasan isi matriks yang sedang ditampilkan: per kolom, per baris, per jenjang, dan sebaran level. */
function hitungInsight(m: Matriks) {
  const perKolom = new Map<string, number>();
  const perBaris = new Map<number, { n: number; jumlah: number }>();
  const perJenjang = new Map<number, { n: number; jumlah: number; jabatan: number }>();
  const level = [0, 0, 0, 0, 0];
  for (const j of m.jabatan) {
    const b = { n: 0, jumlah: 0 };
    for (const k of m.kompetensi) {
      const lv = m.level.get(`${j.id}|${k.kode}`);
      if (!lv) continue;
      b.n++;
      b.jumlah += lv;
      level[lv - 1]++;
      perKolom.set(k.kode, (perKolom.get(k.kode) ?? 0) + 1);
    }
    perBaris.set(j.id, b);
    const g = perJenjang.get(j.jenjang) ?? { n: 0, jumlah: 0, jabatan: 0 };
    g.n += b.n;
    g.jumlah += b.jumlah;
    g.jabatan++;
    perJenjang.set(j.jenjang, g);
  }
  const terisi = level.reduce((a, b) => a + b, 0);
  const teknis = m.kompetensi.filter((k) => k.kategori === "teknis");
  return {
    perKolom,
    perBaris,
    perJenjang: [...perJenjang].sort((a, b) => a[0] - b[0]),
    level,
    terisi,
    rata: terisi ? level.reduce((s, c, i) => s + c * (i + 1), 0) / terisi : 0,
    // kompetensi teknis yang paling banyak dipakai bersama di tampilan ini
    bersama: [...teknis].sort((a, b) => (perKolom.get(b.kode) ?? 0) - (perKolom.get(a.kode) ?? 0)).slice(0, 5),
    // dipakai tepat satu jabatan: penanda keahlian khusus
    spesialis: teknis.filter((k) => perKolom.get(k.kode) === 1).length,
  };
}

function ringkasBaris(b: { n: number; jumlah: number } | undefined) {
  return b?.n ? `${b.n} · ${satuDesimal(b.jumlah / b.n)}` : "–";
}

function Hero({ judul, sub, m, ins }: { judul: string; sub: string; m: Matriks; ins: Insight }) {
  const sel = m.jabatan.length * m.kompetensi.length;
  const angka = [
    { n: fmt(m.jabatan.length), label: "jabatan" },
    { n: fmt(m.kompetensi.length), label: "kompetensi" },
    { n: `${persen(ins.terisi, sel)}%`, label: "sel terisi" },
    { n: satuDesimal(ins.rata), label: "rata-rata level" },
  ];
  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900" aria-label="Ringkasan matriks">
      {/* cahaya dekoratif */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_minmax(0,440px)] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Matriks</span>
            {m.usulan && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-300/30" title="Draf otomatis — perlu direview HC">
                Usulan otomatis
              </span>
            )}
          </div>
          <h2 className="mt-1.5 font-heading text-2xl font-semibold leading-tight">{judul}</h2>
          <p className="text-sm text-brand-200">{sub}</p>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {angka.map((a, i) => (
              <div key={a.label} className="flex animate-[masuk_0.4s_ease-out_both] flex-col-reverse" style={{ animationDelay: `${i * 70}ms` }}>
                <dt className="text-xs text-brand-200">{a.label}</dt>
                <dd className="font-heading text-3xl font-semibold tabular-nums">{a.n}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <div className="mb-2 text-xs text-brand-200">Sebaran {fmt(ins.terisi)} sel menurut level target</div>
          <div className="flex h-3 origin-left animate-[tumbuh_0.8s_ease-out_both] gap-px overflow-hidden rounded-full bg-white/10">
            {ins.level.map((c, i) => c > 0 && <span key={i} className={`lv${i + 1} block`} style={{ width: `${(c / ins.terisi) * 100}%` }} title={`Level ${i + 1}: ${fmt(c)}`} />)}
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1 text-center">
            {LEVEL_NAMA.map((n, i) => (
              <div key={n}>
                <div className={`lv${i + 1} mx-auto grid size-6 place-items-center rounded text-[11px] font-semibold`}>{i + 1}</div>
                <div className="mt-1 truncate text-[11px] text-brand-200">{n}</div>
                <div className="text-xs font-semibold tabular-nums">{persen(ins.level[i], ins.terisi)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function KartuInsight({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-700">{judul}</h2>
      {children}
    </section>
  );
}

function KompetensiBersama({ m, ins }: { m: Matriks; ins: Insight }) {
  const total = m.jabatan.length;
  return (
    <KartuInsight judul="Kompetensi teknis bersama">
      {ins.bersama.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada kompetensi teknis di tampilan ini.</p>
      ) : (
        <>
          <ol className="space-y-2.5">
            {ins.bersama.map((k) => {
              const n = ins.perKolom.get(k.kode) ?? 0;
              return (
                <li key={k.kode}>
                  <Link href={`/kompetensi/${k.kode}`} className="group block">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="w-14 shrink-0 font-mono text-[11px] text-slate-500">{k.kode}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800 group-hover:text-brand-700">{k.nama}</span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">{persen(n, total)}%</span>
                    </div>
                    <div className="ml-16 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full origin-left animate-[tumbuh_0.8s_ease-out_both] rounded-full bg-brand-600" style={{ width: `${persen(n, total)}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[13px] text-slate-600">
            Persentase = porsi dari {fmt(total)} jabatan.{" "}
            {ins.spesialis > 0 && (
              <>
                <b className="text-slate-900">{ins.spesialis}</b> kompetensi teknis hanya dipakai satu jabatan (keahlian khusus).
              </>
            )}
          </p>
        </>
      )}
    </KartuInsight>
  );
}

function LevelPerJenjang({ ins }: { ins: Insight }) {
  const baris = ins.perJenjang.filter(([, g]) => g.n > 0);
  // level target semestinya naik seiring jenjang; tandai bila jenjang lebih tinggi justru lebih rendah rata-ratanya
  const rata = baris.map(([, g]) => g.jumlah / g.n);
  const terbalik = rata.some((r, i) => i > 0 && r > rata[i - 1]);
  return (
    <KartuInsight judul="Level rata-rata per jenjang">
      <div className="space-y-3">
        {baris.map(([jenjang, g], i) => (
          <div key={jenjang}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium text-slate-800">{JENJANG_LABEL[jenjang] ?? `Jenjang ${jenjang}`}</span>
              <span className="shrink-0 font-heading font-semibold tabular-nums text-slate-900">{satuDesimal(rata[i])}</span>
            </div>
            {/* skala 1–5 */}
            <div className="relative mt-1 h-2 rounded-full bg-slate-100">
              <div
                className={`lv${Math.round(rata[i])} absolute inset-y-0 left-0 origin-left animate-[tumbuh_0.8s_ease-out_both] rounded-full`}
                style={{ width: `${(rata[i] / 5) * 100}%` }}
              />
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {g.jabatan} jabatan · rata-rata {satuDesimal(g.n / g.jabatan)} kompetensi
            </div>
          </div>
        ))}
      </div>
      <p className={`mt-3 text-[13px] ${terbalik ? "text-amber-800" : "text-slate-600"}`}>
        {baris.length < 2
          ? "Hanya satu jenjang di tampilan ini."
          : terbalik
            ? "Ada jenjang bawah dengan rata-rata level lebih tinggi dari jenjang di atasnya. Periksa di Kualitas Pemetaan."
            : "Rata-rata level naik seiring jenjang, sesuai harapan."}
      </p>
    </KartuInsight>
  );
}

function ProfilJabatan({ m, ins }: { m: Matriks; ins: Insight }) {
  const isi = m.jabatan.map((j) => ({ j, ...(ins.perBaris.get(j.id) ?? { n: 0, jumlah: 0 }) })).filter((x) => x.n > 0);
  if (!isi.length) return null;
  const terbanyak = isi.reduce((a, b) => (b.n > a.n ? b : a));
  const tersedikit = isi.reduce((a, b) => (b.n < a.n ? b : a));
  const tertinggi = isi.reduce((a, b) => (b.jumlah / b.n > a.jumlah / a.n ? b : a));
  const sorotan = [
    { label: "Kompetensi terbanyak", x: terbanyak, nilai: `${terbanyak.n} kompetensi` },
    { label: "Kompetensi tersedikit", x: tersedikit, nilai: `${tersedikit.n} kompetensi` },
    { label: "Level rata-rata tertinggi", x: tertinggi, nilai: `Lv ${satuDesimal(tertinggi.jumlah / tertinggi.n)}` },
  ];
  const tanpa = m.jabatan.length - isi.length;
  return (
    <KartuInsight judul="Sorotan jabatan">
      <ul className="space-y-2">
        {sorotan.map((s) => (
          <li key={s.label}>
            <Link href={`/jabatan/${s.x.j.kode}`} className="group flex items-center gap-3 rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200 transition hover:ring-brand-300">
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</span>
                <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-brand-700">{s.x.j.nama}</span>
                <span className="block truncate text-xs text-slate-500">{s.x.j.unit_nama}</span>
              </span>
              <span className="shrink-0 font-heading text-sm font-semibold tabular-nums text-brand-700">{s.nilai}</span>
            </Link>
          </li>
        ))}
      </ul>
      {tanpa > 0 && (
        <p className="mt-3 text-[13px] text-amber-800">
          {tanpa} jabatan belum punya kompetensi pada pilihan ini.
        </p>
      )}
    </KartuInsight>
  );
}

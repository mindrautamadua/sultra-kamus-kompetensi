import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Hitung } from "@/components/hitung";
import { DashboardSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageHeader, Stat, Tag } from "@/components/ui";
import { kemiripan, kesenjangan, loadProfil, saranJalur, type Profil, type Saran } from "@/lib/kedekatan";
import { JENJANG_LABEL, KATEGORI_LABEL, LEVEL_NAMA } from "@/lib/labels";

export const metadata: Metadata = { title: "Jalur Karier" };

type Search = { asal?: string; tujuan?: string };

// rotasi terbaik di bawah ambang ini → jabatan spesialis: sulit diisi lewat rotasi dari unit lain
const TERISOLASI = 0.3;
const MUDAH = 0.5; // rotasi terbaik ≥ ambang ini → mudah dirotasi
const KATEGORI = ["inti", "kepemimpinan", "teknis"] as const;
const KATEGORI_WARNA: Record<string, string> = {
  inti: "bg-brand-700",
  kepemimpinan: "bg-amber-400",
  teknis: "bg-sky-400",
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const des = (n: number) =>
  n.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
const tautan = (asal: string, tujuan?: string) => `/karier?${new URLSearchParams(tujuan ? { asal, tujuan } : { asal })}`;

export default function Page(props: PageProps<"/karier">) {
  return (
    <>
      <PageHeader
        title="Jalur Karier"
        desc="Kedekatan profil kompetensi antarjabatan dan kesenjangan yang perlu dikembangkan saat promosi atau rotasi. Dihitung dari pemetaan jabatan–kompetensi saat ini."
      />
      <Suspense fallback={<DashboardSkeleton label="Memuat jalur karier" />}>
        <Karier searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function Karier({ searchParams }: { searchParams: Promise<Search> }) {
  const { asal: asalKode = "", tujuan: tujuanKode = "" } = await searchParams;
  const semua = await loadProfil();
  const byKode = new Map([...semua.values()].map((p) => [p.kode, p]));
  const asal = byKode.get(asalKode);
  const tujuan = byKode.get(tujuanKode);
  const grup = groupBy([...semua.values()], (p) => p.unitInduk);

  return (
    <div className="space-y-6">
      <Form action="" className="filter-bar">
        <PilihJabatan name="asal" label="Jabatan asal" value={asalKode} grup={grup} />
        <PilihJabatan name="tujuan" label="Jabatan tujuan (opsional)" value={tujuanKode} grup={grup} kosong="— lihat saran jalur —" />
        <SubmitButton>Tampilkan</SubmitButton>
        {asal && tujuan && (
          <Link href={tautan(tujuan.kode, asal.kode)} className="btn-secondary">
            ⇄ Tukar arah
          </Link>
        )}
        {asal && (
          <Link href="/karier" className="px-2 py-2 text-sm text-slate-500 hover:text-slate-900">
            Peta mobilitas
          </Link>
        )}
      </Form>

      {!asal ? <PetaMobilitas semua={semua} /> : tujuan ? <Perbandingan asal={asal} tujuan={tujuan} /> : <SaranJalur asal={asal} semua={semua} />}

      <p className="text-xs text-slate-500">
        Kemiripan = kecocokan profil kompetensi <b>teknis</b> beserta levelnya (Σ level terkecil ÷ Σ level terbesar). Kompetensi inti & kepemimpinan tidak
        dihitung karena seragam per jenjang, tetapi tetap masuk rincian kesenjangan. Langkah level = total kenaikan level yang dibutuhkan (kompetensi baru
        dihitung dari 0). Selama pemetaan masih usulan otomatis, hasil ini bersifat indikatif.
      </p>
    </div>
  );
}

function PilihJabatan({
  name,
  label,
  value,
  grup,
  kosong = "Pilih jabatan…",
}: {
  name: string;
  label: string;
  value: string;
  grup: [string, Profil[]][];
  kosong?: string;
}) {
  return (
    <label className="field-label min-w-64 flex-1">
      {label}
      <select name={name} defaultValue={value} className="field">
        <option value="">{kosong}</option>
        {grup.map(([unit, ps]) => (
          <optgroup key={unit} label={unit}>
            {ps.map((p) => (
              <option key={p.kode} value={p.kode}>
                {p.nama}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/* ---------- Peta mobilitas (belum memilih jabatan) ---------- */

function PetaMobilitas({ semua }: { semua: Map<number, Profil> }) {
  const ps = [...semua.values()].filter((p) => p.kompetensi.size > 0);
  const analisa = ps.map((p) => {
    const { atasan, rotasi } = saranJalur(p, semua, 1);
    const keAtasan = atasan && atasan.kompetensi.size ? kesenjangan(p, atasan) : null;
    return { p, atasan, keAtasan, rotasi: rotasi[0] as Saran | undefined };
  });
  const terbaik = analisa.map((a) => a.rotasi?.kemiripan ?? 0);
  const mudah = terbaik.filter((v) => v >= MUDAH).length;
  const terisolasi = analisa.filter((a) => (a.rotasi?.kemiripan ?? 0) < TERISOLASI).sort((a, b) => (a.rotasi?.kemiripan ?? 0) - (b.rotasi?.kemiripan ?? 0));
  const promosi = analisa.filter((a) => a.keAtasan);
  const rataLangkah = promosi.length ? promosi.reduce((s, a) => s + a.keAtasan!.langkah, 0) / promosi.length : 0;

  // pasangan rotasi paling alami (unik per pasangan)
  const pasangan = new Map<string, { a: Profil; b: Profil; v: number }>();
  for (const { p, rotasi } of analisa) {
    if (!rotasi) continue;
    const key = [p.id, rotasi.p.id].sort((x, y) => x - y).join("-");
    if (!pasangan.has(key)) pasangan.set(key, { a: p, b: rotasi.p, v: rotasi.kemiripan });
  }
  const alami = [...pasangan.values()].sort((x, y) => y.v - x.v).slice(0, 8);

  // lompatan promosi per jenjang (ke atasan langsung)
  const lompatan = [4, 3, 2]
    .map((jj) => {
      const xs = promosi.filter((a) => a.p.jenjang === jj);
      const rata = (f: (a: (typeof xs)[number]) => number) => (xs.length ? xs.reduce((s, a) => s + f(a), 0) / xs.length : 0);
      return {
        jj,
        n: xs.length,
        langkah: rata((a) => a.keAtasan!.langkah),
        baru: rata((a) => a.keAtasan!.baru.length),
        naik: rata((a) => a.keAtasan!.naik.length),
      };
    })
    .filter((x) => x.n);
  const maxLangkah = Math.max(1, ...lompatan.map((x) => x.langkah));
  const terberat = [...promosi].sort((a, b) => b.keAtasan!.langkah - a.keAtasan!.langkah).slice(0, 6);

  // histogram kemiripan rotasi terbaik
  // batas pertama = TERISOLASI, kedua = MUDAH, supaya warna batang sejalan dengan kartu statistik
  const ember = [
    [0, TERISOLASI],
    [TERISOLASI, MUDAH],
    [MUDAH, 0.7],
    [0.7, 0.9],
    [0.9, 1.01],
  ].map(([min, max]) => ({
    min,
    max,
    n: terbaik.filter((v) => v >= min && v < max).length,
  }));
  const maxEmber = Math.max(1, ...ember.map((e) => e.n));

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900" aria-label="Peta mobilitas">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Peta mobilitas</div>
            <p className="mt-1.5 font-heading text-xl font-medium leading-snug">
              {ps.length} jabatan
              <span className="text-brand-200">
                {" "}
                dipetakan. {mudah} punya padanan di unit lain dengan kemiripan ≥{pct(MUDAH)}, sedangkan {terisolasi.length} bersifat spesialis (&lt;
                {pct(TERISOLASI)}) — penggantinya perlu disiapkan dari dalam unit.
              </span>
            </p>
            <p className="mt-3 text-sm text-brand-200">Pilih jabatan asal di atas untuk melihat tangga karier, saran promosi & rotasi, dan calon penerusnya.</p>
          </div>
          <div className="lg:col-span-3">
            <div className="mb-2 text-xs text-brand-200">Sebaran kemiripan rotasi terbaik tiap jabatan</div>
            <div className="flex h-32 items-end gap-2">
              {ember.map((e, i) => (
                <div key={e.min} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs font-semibold tabular-nums">{e.n}</span>
                  <div
                    className={`w-full origin-bottom animate-[naik_0.7s_ease-out_both] rounded-t-md ${e.min < TERISOLASI ? "bg-gradient-to-t from-amber-500 to-amber-300" : e.min >= MUDAH ? "bg-gradient-to-t from-emerald-500 to-emerald-300" : "bg-gradient-to-t from-brand-500 to-brand-300"}`}
                    style={{
                      height: `${(e.n / maxEmber) * 80}%`,
                      animationDelay: `${i * 70}ms`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2 border-t border-white/10 pt-1.5">
              {ember.map((e) => (
                <span key={e.min} className="flex-1 text-center text-[11px] text-brand-300">
                  {Math.round(e.min * 100)}–{Math.min(100, Math.round(e.max * 100))}%
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="M4 10h12M12 6l4 4-4 4" label="Mudah dirotasi" value={<Hitung n={mudah} />} hint={`rotasi terbaik ≥${pct(MUDAH)} mirip`} aksen="emerald" />
        <Stat
          icon="M10 3 2.5 16.5h15zM10 8v4M10 14.3v.2"
          label="Spesialis"
          value={<Hitung n={terisolasi.length} />}
          hint={`tidak ada padanan ≥${pct(TERISOLASI)} di unit lain`}
          href="#terisolasi"
          aksen={terisolasi.length ? "amber" : "emerald"}
        />
        <Stat
          icon="M4 16V12h4V8h4V4h4M13 4h3v3"
          label="Langkah ke atasan"
          value={des(rataLangkah)}
          hint="rata-rata kenaikan level untuk promosi ke atasan langsung"
        />
        <Stat
          icon="M7 6a3.5 3.5 0 1 0 0 7M13 7a3.5 3.5 0 1 1 0 7"
          label="Kemiripan rotasi"
          value={pct(terbaik.length ? terbaik.reduce((s, v) => s + v, 0) / terbaik.length : 0)}
          hint="rata-rata rotasi terbaik per jabatan"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Pasangan rotasi paling alami">
          <ul className="divide-y divide-slate-50 text-sm">
            {alami.map(({ a, b, v }) => (
              <li key={`${a.id}-${b.id}`}>
                <Link
                  href={tautan(a.kode, b.kode)}
                  className="grid grid-cols-1 items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-slate-50 sm:grid-cols-[1fr_auto_1fr_4.5rem]"
                >
                  <Nama p={a} />
                  <span className="hidden text-slate-300 sm:block" aria-hidden>
                    ⇄
                  </span>
                  <Nama p={b} />
                  <Meter v={v} kecil />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Lompatan promosi ke atasan langsung">
          <div className="p-4">
            <ul className="space-y-4">
              {lompatan.map((x, i) => (
                <li key={x.jj}>
                  <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
                    <span className="text-slate-800">
                      {JENJANG_LABEL[x.jj]} <span className="text-slate-400">→</span> {JENJANG_LABEL[x.jj - 1]}
                    </span>
                    <span className="tabular-nums text-slate-600">
                      <b className="text-slate-900">{des(x.langkah)}</b> langkah
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-2 origin-left animate-[tumbuh_0.8s_ease-out_both] rounded-full bg-gradient-to-r from-brand-700 to-brand-400"
                      style={{
                        width: `${(x.langkah / maxLangkah) * 100}%`,
                        animationDelay: `${i * 80}ms`,
                      }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    rata-rata {des(x.baru)} kompetensi baru · {des(x.naik)} naik level · {x.n} jabatan
                  </div>
                </li>
              ))}
            </ul>
            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Lompatan terberat</h3>
            <ul className="space-y-1.5 text-sm">
              {terberat.map(({ p, atasan, keAtasan }) => (
                <li key={p.id}>
                  <Link href={tautan(p.kode, atasan!.kode)} className="flex items-baseline gap-2 hover:text-brand-700">
                    <span className="min-w-0 flex-1 truncate">
                      {p.nama} <span className="text-slate-400">→</span> {atasan!.nama} <span className="text-xs text-slate-500">· {p.unitInduk}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{keAtasan!.langkah}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <Card title={`Jabatan spesialis — sulit diisi lewat rotasi (${terisolasi.length})`}>
        <div id="terisolasi" className="scroll-mt-6">
          <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            Profil teknisnya tidak mirip (&lt;{pct(TERISOLASI)}) dengan jabatan sejenjang mana pun di unit lain. Wajar untuk fungsi khusus, tetapi penggantinya
            sulit dicari lewat rotasi, jadi perlu disiapkan dari dalam unit (kaderisasi) atau rekrutmen.
          </p>
          {terisolasi.length === 0 ? (
            <p className="px-4 py-4 text-sm text-emerald-700">Tidak ada. Setiap jabatan punya padanan rotasi yang cukup mirip.</p>
          ) : (
            <ul className="grid grid-cols-1 max-h-96 gap-x-6 overflow-auto px-4 py-2 text-sm md:grid-cols-2">
              {terisolasi.map(({ p, rotasi }) => (
                <li key={p.id} className="border-b border-slate-50 py-1.5">
                  <Link href={tautan(p.kode)} className="flex items-baseline gap-2 hover:text-brand-700">
                    <span className="min-w-0 flex-1 truncate">
                      {p.nama} <span className="text-xs text-slate-500">· {p.unitInduk}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-amber-700">{pct(rotasi?.kemiripan ?? 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Saran jalur (asal saja) ---------- */

function SaranJalur({ asal, semua }: { asal: Profil; semua: Map<number, Profil> }) {
  const { promosi, rotasi } = saranJalur(asal, semua);

  // tangga karier: rantai atasan langsung sampai puncak, dengan langkah tiap anak tangga
  const tangga: { p: Profil; langkah: number; kumulatif: number }[] = [];
  let kini = asal;
  let total = 0;
  const dilihat = new Set([asal.id]);
  while (kini.atasanId && semua.has(kini.atasanId) && !dilihat.has(kini.atasanId)) {
    const naik = semua.get(kini.atasanId)!;
    dilihat.add(naik.id);
    const l = naik.kompetensi.size ? kesenjangan(kini, naik).langkah : 0;
    total += l;
    tangga.push({ p: naik, langkah: l, kumulatif: total });
    kini = naik;
  }

  // calon penerus: jabatan satu jenjang di bawah yang profilnya paling dekat ke jabatan ini
  const penerus = [...semua.values()]
    .filter((p) => p.jenjang === asal.jenjang + 1 && p.kompetensi.size > 0)
    .map((p) => ({
      p,
      v: kemiripan(p, asal),
      langkah: kesenjangan(p, asal).langkah,
      langsung: p.atasanId === asal.id,
    }))
    .sort((a, b) => Number(b.langsung) - Number(a.langsung) || b.v - a.v)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ProfilGelap p={asal} judul="Jabatan asal" />
          </div>
          <div className="lg:col-span-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Tangga karier lewat garis atasan</div>
            {tangga.length === 0 ? (
              <p className="text-sm text-brand-200">Tidak ada atasan dengan pemetaan kompetensi di atas jabatan ini.</p>
            ) : (
              <ol className="space-y-2">
                {[...tangga].reverse().map((t, i) => (
                  <li
                    key={t.p.id}
                    className="animate-[masuk_0.45s_ease-out_both]"
                    style={{
                      marginLeft: `${(tangga.length - 1 - i) * 1.25}rem`,
                      animationDelay: `${i * 80}ms`,
                    }}
                  >
                    <Link
                      href={tautan(asal.kode, t.p.kode)}
                      className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3.5 py-2.5 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{t.p.nama}</span>
                        <span className="block text-[11px] text-brand-300">{JENJANG_LABEL[t.p.jenjang]}</span>
                      </span>
                      <span className="text-right text-xs tabular-nums">
                        <span className="block text-brand-200">+{t.langkah} langkah</span>
                        <span className="block font-semibold text-amber-300">Σ {t.kumulatif}</span>
                      </span>
                    </Link>
                  </li>
                ))}
                <li style={{ marginLeft: `${tangga.length * 1.25}rem` }}>
                  <div className="rounded-xl bg-amber-400 px-3.5 py-2.5 text-sm font-semibold text-brand-950">{asal.nama} · posisi sekarang</div>
                </li>
              </ol>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title={`Promosi — ${asal.jenjang > 1 ? JENJANG_LABEL[asal.jenjang - 1] : "jenjang tertinggi"}`}>
          <DaftarSaran asal={asal} saran={promosi} kosong="Tidak ada jabatan satu jenjang di atas." />
        </Card>
        <Card title="Rotasi — jabatan sejenjang di unit lain">
          <DaftarSaran asal={asal} saran={rotasi} kosong="Tidak ada jabatan sejenjang dengan profil kompetensi yang bisa dibandingkan." />
        </Card>
      </div>

      {asal.jenjang < 4 && (
        <Card title="Calon penerus — jabatan satu jenjang di bawah yang paling siap">
          {penerus.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500">Tidak ada jabatan di jenjang bawahnya.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {penerus.map(({ p, v, langkah, langsung }) => (
                <Link
                  key={p.id}
                  href={tautan(p.kode, asal.kode)}
                  className="group rounded-xl border border-slate-200 p-3.5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-snug text-slate-900 group-hover:text-brand-700">{p.nama}</span>
                    {langsung && <Tag>bawahan langsung</Tag>}
                  </div>
                  <div className="mb-2 mt-0.5 truncate text-xs text-slate-500">{p.unitInduk}</div>
                  <Meter v={v} />
                  <div className="mt-1.5 text-xs text-slate-500">
                    <b className="tabular-nums text-slate-800">{langkah}</b> langkah level menuju jabatan ini
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function DaftarSaran({ asal, saran, kosong }: { asal: Profil; saran: Saran[]; kosong: string }) {
  if (!saran.length) return <p className="px-4 py-4 text-sm text-slate-500">{kosong}</p>;
  const maxLangkah = Math.max(1, ...saran.map((s) => s.langkah));
  return (
    <ul className="divide-y divide-slate-50 text-sm">
      {saran.map((s, i) => (
        <li key={s.p.id}>
          <Link
            href={tautan(asal.kode, s.p.kode)}
            className="group grid grid-cols-1 items-center gap-x-4 gap-y-1.5 px-4 py-2.5 hover:bg-slate-50 sm:grid-cols-[1fr_7rem_5.5rem]"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                {i === 0 && s.alasan !== "atasan langsung" && <span className="size-1.5 shrink-0 rounded-full bg-amber-400" title="Paling mirip" />}
                <span className="truncate font-medium text-slate-900 group-hover:text-brand-700">{s.p.nama}</span>
              </span>
              <span className="block truncate text-xs text-slate-500">{s.alasan === "atasan langsung" ? <Tag>atasan langsung</Tag> : s.p.unitInduk}</span>
            </span>
            <Meter v={s.kemiripan} kecil />
            <span className="flex items-center gap-2" title="Total kenaikan level yang dibutuhkan">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(s.langkah / maxLangkah) * 100}%` }} />
              </span>
              <span className="w-6 text-right text-xs font-semibold tabular-nums text-slate-700">{s.langkah}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Perbandingan asal → tujuan ---------- */

function Perbandingan({ asal, tujuan }: { asal: Profil; tujuan: Profil }) {
  const g = kesenjangan(asal, tujuan);
  const arah = tujuan.jenjang < asal.jenjang ? "Promosi" : tujuan.jenjang === asal.jenjang ? "Rotasi" : "Ke jenjang lebih rendah";
  const dibutuhkan = tujuan.kompetensi.size;
  const siap = dibutuhkan ? g.memenuhi.length / dibutuhkan : 0;
  // fokus pengembangan: selisih level terbesar lebih dulu
  const fokus = [...g.baru.map((k) => ({ k, dari: 0 })), ...g.naik.map((k) => ({ k, dari: k.dari }))]
    .sort((a, b) => b.k.level - b.dari - (a.k.level - a.dari))
    .slice(0, 5);
  const baris = [
    ...g.baru.map((k) => ({
      k,
      dari: 0,
      ke: k.level,
      status: "baru" as const,
    })),
    ...g.naik.map((k) => ({
      k,
      dari: k.dari,
      ke: k.level,
      status: "naik" as const,
    })),
    ...g.memenuhi.map((k) => ({
      k,
      dari: k.dari,
      ke: k.level,
      status: "memenuhi" as const,
    })),
    ...g.lepas.map((k) => ({
      k,
      dari: k.level,
      ke: 0,
      status: "lepas" as const,
    })),
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
        <div className="relative grid grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <ProfilGelap p={asal} judul="Dari" />
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-300/30">{arah}</span>
            <Cincin v={siap} label="siap" />
            <span className="text-xs text-brand-200">
              kemiripan teknis <b className="text-white">{pct(g.kemiripan)}</b>
            </span>
          </div>
          <ProfilGelap p={tujuan} judul="Ke" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon="M4.5 10.5l3.5 3.5 7.5-8"
          label="Sudah memenuhi"
          value={`${g.memenuhi.length}/${dibutuhkan}`}
          hint="kompetensi jabatan tujuan"
          aksen="emerald"
        />
        <Stat
          icon="M10 4v12M4 10h12"
          label="Kompetensi baru"
          value={g.baru.length}
          hint={g.baru.length ? "belum dimiliki sama sekali" : "Tidak ada"}
          aksen={g.baru.length ? "amber" : "emerald"}
        />
        <Stat
          icon="M10 16V4M5 9l5-5 5 5"
          label="Harus naik level"
          value={g.naik.length}
          hint={g.naik.length ? "dimiliki, level belum cukup" : "Tidak ada"}
          aksen={g.naik.length ? "amber" : "emerald"}
        />
        <Stat icon="M4 16V12h4V8h4V4h4M13 4h3v3" label="Total langkah level" value={g.langkah} hint="kenaikan level yang dibutuhkan" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Peta kesenjangan level" className="min-w-0 xl:col-span-2" action={<LegendaPeta />}>
          {KATEGORI.map((kat) => {
            const rs = baris.filter((b) => b.k.kategori === kat);
            if (!rs.length) return null;
            return (
              <div key={kat}>
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <span className={`size-2.5 rounded-sm ${KATEGORI_WARNA[kat]}`} aria-hidden />
                  Kompetensi {KATEGORI_LABEL[kat].toLowerCase()}
                </div>
                <ul className="divide-y divide-slate-50 text-sm">
                  {rs.map((b) => (
                    <li key={b.k.kode} className="grid grid-cols-1 items-center gap-x-4 gap-y-1 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_13rem]">
                      <Link href={`/kompetensi/${b.k.kode}`} className="min-w-0 truncate hover:text-brand-700" title={b.k.nama}>
                        <span className="mr-2 font-mono text-xs text-slate-500">{b.k.kode}</span>
                        {b.k.nama}
                      </Link>
                      <Dumbbell dari={b.dari} ke={b.ke} status={b.status} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Card>

        <div className="space-y-6">
          <Card title="Fokus pengembangan">
            {fokus.length === 0 ? (
              <p className="px-4 py-4 text-sm text-emerald-700">Semua kompetensi jabatan tujuan sudah terpenuhi.</p>
            ) : (
              <ol className="divide-y divide-slate-50 text-sm">
                {fokus.map(({ k, dari }, i) => (
                  <li key={k.kode} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-amber-50 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                      {i + 1}
                    </span>
                    <Link href={`/kompetensi/${k.kode}`} className="min-w-0 flex-1 hover:text-brand-700">
                      <span className="block truncate">{k.nama}</span>
                      <span className="text-xs text-slate-500">
                        {dari ? `L${dari} → L${k.level}` : `baru, sampai L${k.level} · ${LEVEL_NAMA[k.level - 1]}`}
                      </span>
                    </Link>
                    <span className="text-xs font-semibold tabular-nums text-amber-700">+{k.level - dari}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          {g.lepas.length > 0 && (
            <Card title={`Tidak dibutuhkan lagi (${g.lepas.length})`}>
              <ul className="divide-y divide-slate-50 text-sm">
                {g.lepas.map((k) => (
                  <li key={k.kode} className="flex items-center gap-3 px-4 py-2">
                    <Link href={`/kompetensi/${k.kode}`} className="min-w-0 flex-1 truncate text-slate-600 hover:text-brand-700">
                      <span className="mr-2 font-mono text-xs text-slate-400">{k.kode}</span>
                      {k.nama}
                    </Link>
                    <Level lv={k.level} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const WARNA_STATUS = {
  baru: "bg-rose-500",
  naik: "bg-amber-500",
  memenuhi: "bg-emerald-500",
  lepas: "bg-slate-300",
} as const;

/** Level asal (titik kosong) dan tujuan (titik penuh) pada skala 0–5, dihubungkan garis. */
function Dumbbell({ dari, ke, status }: { dari: number; ke: number; status: keyof typeof WARNA_STATUS }) {
  const x = (lv: number) => `${(lv / 5) * 100}%`;
  const kiri = Math.min(dari, ke);
  const kanan = Math.max(dari, ke);
  const teks = status === "lepas" ? `L${dari}, tidak dibutuhkan` : status === "baru" ? `belum ada → L${ke}` : `L${dari} → L${ke}`;
  return (
    <span className="relative block h-5" role="img" aria-label={teks} title={teks}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" aria-hidden />
      {[1, 2, 3, 4, 5].map((l) => (
        <span key={l} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-slate-200" style={{ left: x(l) }} aria-hidden />
      ))}
      <span
        className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${WARNA_STATUS[status]} opacity-40`}
        style={{ left: x(kiri), width: `${((kanan - kiri) / 5) * 100}%` }}
        aria-hidden
      />
      {status !== "baru" && (
        <span
          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white ${status === "lepas" ? "border-slate-400" : "border-slate-500"}`}
          style={{ left: x(dari) }}
          aria-hidden
        />
      )}
      {status !== "lepas" && (
        <span
          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${WARNA_STATUS[status]}`}
          style={{ left: x(ke) }}
          aria-hidden
        />
      )}
    </span>
  );
}

function LegendaPeta() {
  return (
    <span className="hidden flex-wrap items-center gap-3 text-[11px] text-slate-500 sm:flex">
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-full border-2 border-slate-500 bg-white" aria-hidden />
        asal
      </span>
      {(["baru", "naik", "memenuhi"] as const).map((s) => (
        <span key={s} className="flex items-center gap-1">
          <span className={`size-2.5 rounded-full ${WARNA_STATUS[s]}`} aria-hidden />
          {s}
        </span>
      ))}
    </span>
  );
}

/* ---------- komponen kecil ---------- */

function ProfilGelap({ p, judul }: { p: Profil; judul: string }) {
  const ks = [...p.kompetensi.values()];
  const rataLevel = ks.length ? ks.reduce((s, k) => s + k.level, 0) / ks.length : 0;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">{judul}</div>
      <Link href={`/jabatan/${p.kode}`} className="mt-1 block font-heading text-xl font-semibold leading-snug hover:underline">
        {p.nama}
      </Link>
      <div className="mt-1 text-sm text-brand-200">
        {p.unitInduk} · {JENJANG_LABEL[p.jenjang]}
      </div>
      <div className="mt-3 flex h-2 gap-px overflow-hidden rounded-full bg-white/10">
        {KATEGORI.map((k) => {
          const n = ks.filter((x) => x.kategori === k).length;
          return (
            n > 0 && (
              <span
                key={k}
                className={`block ${KATEGORI_WARNA[k]}`}
                style={{ width: `${(n / ks.length) * 100}%` }}
                title={`${n} ${KATEGORI_LABEL[k].toLowerCase()}`}
              />
            )
          );
        })}
      </div>
      <div className="mt-1.5 text-xs text-brand-300">
        {ks.length} kompetensi · rata-rata L{des(rataLevel)}
      </div>
    </div>
  );
}

function Nama({ p }: { p: Profil }) {
  return (
    <span className="min-w-0">
      <span className="block truncate font-medium text-slate-900">{p.nama}</span>
      <span className="block truncate text-xs text-slate-500">{p.unitInduk}</span>
    </span>
  );
}

function Cincin({ v, label }: { v: number; label: string }) {
  const r = 40;
  const keliling = 2 * Math.PI * r;
  return (
    <div className="relative size-28">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-white/10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--color-amber-400)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={keliling}
          strokeDashoffset={keliling * (1 - v)}
          className="animate-[lingkar_1.1s_ease-out_both]"
          style={{ "--penuh": keliling } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-heading text-2xl font-semibold tabular-nums">{pct(v)}</div>
          <div className="text-[10px] uppercase tracking-wide text-brand-200">{label}</div>
        </div>
      </div>
    </div>
  );
}

function Level({ lv }: { lv: number }) {
  return (
    <span className={`inline-block min-w-[4.5rem] rounded px-1.5 py-0.5 text-center text-xs lv${lv}`} title={LEVEL_NAMA[lv - 1]}>
      {lv} · {LEVEL_NAMA[lv - 1]}
    </span>
  );
}

function Meter({ v, kecil = false }: { v: number; kecil?: boolean }) {
  return (
    <span className="flex items-center gap-2" title={`Kemiripan ${pct(v)}`}>
      <span className={`flex-1 overflow-hidden rounded-full bg-slate-100 ${kecil ? "h-1.5" : "h-2"}`}>
        <span className="block h-full rounded-full bg-gradient-to-r from-brand-700 to-brand-400" style={{ width: `${v * 100}%` }} />
      </span>
      <span className="w-9 text-right text-xs tabular-nums text-slate-600">{pct(v)}</span>
    </span>
  );
}

function groupBy<T>(xs: T[], key: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m];
}

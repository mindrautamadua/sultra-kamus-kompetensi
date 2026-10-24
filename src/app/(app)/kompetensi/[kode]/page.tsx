import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PdfLink, StatusBadge, Tag } from "@/components/ui";
import { DetailSkeleton } from "@/components/skeleton";
import { penggunaSaatIni, sesiSaatIni } from "@/lib/auth";
import { PENILAIAN_DIRI_AKTIF } from "@/lib/fitur";
import { bolehEdit } from "@/lib/peran";
import { must, supabase } from "@/lib/supabase";
import { admin, ok } from "@/lib/supabase-admin";
import { type JabatanTarget, type Level, LevelInteraktif } from "./level-interaktif";
import { PenilaianDiri } from "./penilaian-diri";

const PAGE = 1000; // = max_rows PostgREST di supabase/config.toml

export default function Page(props: PageProps<"/kompetensi/[kode]">) {
  return (
    <>
      <Link href="/kompetensi" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Kamus Kompetensi
      </Link>
      <Suspense fallback={<DetailSkeleton label="Memuat detail kompetensi" />}>
        <Detail params={props.params} />
      </Suspense>
    </>
  );
}

async function Detail({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const k = await supabase
    .from("kompetensi")
    .select(
      `id, kode, nama, nama_daftar_isi, bidang_id, definisi, status, tanda_c, catatan, kode_dokumen, file_sumber,
       bidang:bidang_kompetensi!kompetensi_bidang_id_fkey(kode, nama),
       level:kompetensi_level(level, nama_level, deskripsi, indikator:indikator_perilaku(urutan, deskripsi)),
       terkait:kompetensi_bidang_terkait(catatan, bidang:bidang_kompetensi(kode, nama)),
       jabatan:jabatan_kompetensi(level_target, jabatan(id, kode, nama))`,
    )
    .eq("kode", decodeURIComponent(kode))
    .maybeSingle()
    .then(must);
  if (!k) notFound();

  const levels = [...k.level].sort((a, b) => a.level - b.level);
  const dataLevel: Level[] = levels.map((l) => ({
    level: l.level,
    nama_level: l.nama_level,
    deskripsi: l.deskripsi,
    indikator: [...l.indikator].sort((a, b) => a.urutan - b.urutan),
  }));
  const dataJabatan: JabatanTarget[] = k.jabatan.flatMap((j) => (j.jabatan ? [{ kode: j.jabatan.kode, nama: j.jabatan.nama, level: j.level_target }] : []));

  return (
    <article className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-slate-500">{k.kode}</span>
          <Link href={`/kompetensi?bidang=${k.bidang?.kode}`} className="text-brand-700 hover:underline">
            {k.bidang?.nama}
          </Link>
          <StatusBadge status={k.status} />
          {k.tanda_c && <Tag title='Bertanda "(C)" pada dokumen sumber'>(C)</Tag>}
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{k.nama}</h1>
          <div className="flex flex-wrap gap-2">
            <PdfLink href={`/dokumen/kompetensi/${k.kode}`}>PDF</PdfLink>
            {bolehEdit((await penggunaSaatIni())?.peran) && (
              <Link href={`/kompetensi/${k.kode}/edit`} className="btn-secondary h-9 shrink-0 text-[13px]">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-4" aria-hidden>
                  <path d="M12.5 4.5l3 3L8 15H5v-3z" strokeLinejoin="round" />
                </svg>
                Edit kompetensi
              </Link>
            )}
          </div>
        </div>
        {k.nama_daftar_isi && <p className="mt-1 text-sm text-slate-500">Nama di daftar isi: {k.nama_daftar_isi}</p>}
        {k.definisi ? (
          <p className="mt-3 max-w-4xl leading-relaxed text-slate-700">{k.definisi}</p>
        ) : (
          <p className="mt-3 text-sm italic text-slate-500">Definisi belum tersedia.</p>
        )}
      </header>

      {(k.catatan.length > 0 || k.terkait.length > 0 || k.kode_dokumen) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
          <div className="mb-1 font-semibold">Catatan dari dokumen sumber</div>
          <ul className="list-disc space-y-1 pl-5">
            {k.catatan.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
            {k.terkait.map((t, i) => (
              <li key={`t${i}`}>
                Juga dicantumkan di kamus bidang <b>{t.bidang?.nama}</b>
                {t.catatan ? ` — ${t.catatan}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <LevelInteraktif levels={dataLevel} jabatan={dataJabatan} />

      {PENILAIAN_DIRI_AKTIF && (
        <Suspense fallback={null}>
          <PenilaianSaya kompetensiId={k.id} kode={k.kode} levels={dataLevel} jabatan={dataJabatan} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <Terkait kode={k.kode} jabatanId={k.jabatan.flatMap((j) => (j.jabatan ? [j.jabatan.id] : []))} />
      </Suspense>

      <Tetangga kode={k.kode} bidangId={k.bidang_id} />

      <p className="text-xs text-slate-500">
        Sumber: {k.file_sumber}
        {k.kode_dokumen && ` · kode di dokumen: ${k.kode_dokumen}`}
      </p>
    </article>
  );
}

/** Penilaian diri milik pengguna yang login (tabelnya hanya terbaca lewat service role). */
async function PenilaianSaya({ kompetensiId, kode, levels, jabatan }: { kompetensiId: number; kode: string; levels: Level[]; jabatan: JabatanTarget[] }) {
  const s = await sesiSaatIni();
  if (!s) return null;
  const row = ok(
    await admin()
      .from("penilaian_diri")
      .select("dicentang, updated_at, jabatan(kode)")
      .eq("pengguna_id", s.id)
      .eq("kompetensi_id", kompetensiId)
      .maybeSingle(),
  );
  return (
    <PenilaianDiri
      kode={kode}
      levels={levels}
      jabatan={jabatan}
      awal={row && { jabatanKode: row.jabatan?.kode ?? null, dicentang: row.dicentang, disimpan: row.updated_at }}
    />
  );
}

/**
 * Kompetensi teknis yang paling sering muncul bersama kompetensi ini pada jabatan yang sama.
 * Inti & kepemimpinan diabaikan karena dipetakan ke hampir semua jabatan.
 */
async function Terkait({ kode, jabatanId }: { kode: string; jabatanId: number[] }) {
  if (jabatanId.length === 0) return null;
  const hitung = new Map<string, { nama: string; n: number }>();
  for (let from = 0; ; from += PAGE) {
    const rows = await supabase
      .from("v_jabatan_kompetensi")
      .select("kompetensi_kode, kompetensi_nama")
      .in("jabatan_id", jabatanId)
      .eq("kategori", "teknis")
      .neq("kompetensi_kode", kode)
      .order("id")
      .range(from, from + PAGE - 1)
      .then(must);
    for (const r of rows) {
      const h = hitung.get(r.kompetensi_kode!) ?? { nama: r.kompetensi_nama!, n: 0 };
      h.n++;
      hitung.set(r.kompetensi_kode!, h);
    }
    if (rows.length < PAGE) break;
  }
  const top = [...hitung.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  if (top.length === 0) return null;

  return (
    <section>
      <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-slate-700">Sering muncul bersama</h2>
      <p className="mb-3 text-sm text-slate-500">Kompetensi teknis yang juga dipetakan ke jabatan-jabatan di atas.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {top.map(([kd, { nama, n }]) => (
          <li key={kd}>
            <Link href={`/kompetensi/${kd}`} className="group block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-slate-500">{kd}</span>
                <span className="tabular-nums text-slate-500">
                  {n} dari {jabatanId.length} jabatan
                </span>
              </div>
              <div className="mt-1 truncate font-medium text-slate-900 group-hover:text-brand-700">{nama}</div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div className="h-full rounded-full bg-brand-400" style={{ width: `${(n / jabatanId.length) * 100}%` }} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Tautan ke kompetensi sebelum & sesudahnya dalam bidang yang sama. */
async function Tetangga({ kode, bidangId }: { kode: string; bidangId: number }) {
  const rows = await supabase.from("kompetensi").select("kode, nama").eq("bidang_id", bidangId).order("urutan").then(must);
  const i = rows.findIndex((r) => r.kode === kode);
  const prev = rows[i - 1];
  const next = rows[i + 1];
  if (!prev && !next) return null;

  return (
    <nav aria-label="Kompetensi lain di bidang ini" className="grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2">
      {prev ? (
        <Link href={`/kompetensi/${prev.kode}`} className="group rounded-xl border border-slate-200 bg-white p-3 hover:border-brand-300">
          <div className="text-xs text-slate-500">← Sebelumnya · {prev.kode}</div>
          <div className="truncate font-medium text-slate-900 group-hover:text-brand-700">{prev.nama}</div>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={`/kompetensi/${next.kode}`} className="group rounded-xl border border-slate-200 bg-white p-3 text-right hover:border-brand-300">
          <div className="text-xs text-slate-500">
            Berikutnya · {next.kode} →
          </div>
          <div className="truncate font-medium text-slate-900 group-hover:text-brand-700">{next.nama}</div>
        </Link>
      )}
    </nav>
  );
}

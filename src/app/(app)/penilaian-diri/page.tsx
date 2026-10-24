import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AnalisaSkeleton } from "@/components/skeleton";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { sesiSaatIni } from "@/lib/auth";
import { PENILAIAN_DIRI_AKTIF } from "@/lib/fitur";
import { LEVEL_NAMA } from "@/lib/labels";
import { admin, ok } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: "Penilaian Diri" };

export default function Page(props: PageProps<"/penilaian-diri">) {
  if (!PENILAIAN_DIRI_AKTIF) notFound();
  return (
    <>
      <PageHeader
        title="Penilaian Diri"
        desc="Rekap penilaian diri per kompetensi: perkiraan level dari indikator yang dicentang, dibandingkan dengan level target jabatan. Hasilnya subjektif, gunakan sebagai bahan awal diskusi dengan atasan atau HC."
      />
      <Suspense fallback={<AnalisaSkeleton />}>
        <Rekap searchParams={props.searchParams as Promise<{ lihat?: string }>} />
      </Suspense>
    </>
  );
}

async function Rekap({ searchParams }: { searchParams: Promise<{ lihat?: string }> }) {
  const { lihat = "" } = await searchParams;
  const semua = lihat === "semua";
  const s = await sesiSaatIni();

  let query = admin()
    .from("penilaian_diri")
    .select("id, level_perkiraan, level_target, updated_at, pengguna(nama), kompetensi(kode, nama), jabatan(kode, nama)")
    .order("updated_at", { ascending: false });
  if (!semua) query = query.eq("pengguna_id", s?.id ?? -1);
  const rows = ok(await query);

  const bertarget = rows.filter((r) => r.level_target !== null);
  const kurang = bertarget.filter((r) => r.level_perkiraan < r.level_target!);

  return (
    <div className="space-y-6">
      <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm font-medium w-fit" role="group" aria-label="Penilaian yang ditampilkan">
        <Link href="/penilaian-diri" aria-current={!semua ? "page" : undefined} className={`rounded-md px-3 py-1.5 ${!semua ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
          Milik saya
        </Link>
        <Link href="/penilaian-diri?lihat=semua" aria-current={semua ? "page" : undefined} className={`rounded-md px-3 py-1.5 ${semua ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
          Semua pengguna
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Kompetensi dinilai" value={String(rows.length)} hint={semua ? `oleh ${new Set(rows.map((r) => r.pengguna?.nama)).size} pengguna` : undefined} />
        <Stat label="Memenuhi target" value={String(bertarget.length - kurang.length)} hint={`dari ${bertarget.length} yang punya target jabatan`} />
        <Stat label="Di bawah target" value={String(kurang.length)} hint="perlu rencana pengembangan" />
      </div>

      {rows.length === 0 ? (
        <Empty>
          Belum ada penilaian diri. Buka salah satu kompetensi di{" "}
          <Link href="/kompetensi" className="link">
            Kamus Kompetensi
          </Link>{" "}
          lalu pilih <b>Mulai penilaian diri</b>.
        </Empty>
      ) : (
        <Card title={semua ? "Semua penilaian" : "Penilaian saya"}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {semua && <th className="px-4 py-2">Pengguna</th>}
                  <th className="px-4 py-2">Kompetensi</th>
                  <th className="px-4 py-2">Jabatan pembanding</th>
                  <th className="px-4 py-2">Perkiraan</th>
                  <th className="px-4 py-2">Target</th>
                  <th className="px-4 py-2">Selisih</th>
                  <th className="px-4 py-2">Diperbarui</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const selisih = r.level_target === null ? null : r.level_perkiraan - r.level_target;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      {semua && <td className="px-4 py-2 whitespace-nowrap">{r.pengguna?.nama}</td>}
                      <td className="px-4 py-2">
                        <Link href={`/kompetensi/${r.kompetensi?.kode}#penilaian`} className="hover:text-brand-700 hover:underline">
                          <span className="mr-2 font-mono text-xs text-slate-500">{r.kompetensi?.kode}</span>
                          {r.kompetensi?.nama}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{r.jabatan?.nama ?? "—"}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <LevelChip level={r.level_perkiraan} />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{r.level_target ? <LevelChip level={r.level_target} /> : "—"}</td>
                      <td className={`px-4 py-2 font-semibold tabular-nums ${selisih === null ? "text-slate-400" : selisih < 0 ? "text-amber-800" : "text-emerald-700"}`}>
                        {selisih === null ? "—" : selisih > 0 ? `+${selisih}` : selisih}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-500">{new Date(r.updated_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function LevelChip({ level }: { level: number }) {
  if (!level) return <span className="text-xs text-slate-500">Belum level 1</span>;
  return (
    <span className={`lv${level} rounded px-1.5 py-0.5 text-[11px] font-semibold`}>
      {level} · {LEVEL_NAMA[level - 1]}
    </span>
  );
}

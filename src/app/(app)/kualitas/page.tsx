import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Hitung } from "@/components/hitung";
import { DashboardSkeleton } from "@/components/skeleton";
import { Batang, Card, PageHeader, Stat } from "@/components/ui";
import { JENJANG_LABEL, fmt } from "@/lib/labels";
import { loadKualitas, persen } from "@/lib/kualitas";

export const metadata: Metadata = { title: "Kualitas Pemetaan" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Kualitas Pemetaan"
        desc="Cakupan kamus terhadap jabatan dan cek konsistensi pemetaan jabatan–kompetensi. Dihitung langsung dari database, jadi ikut berubah setiap kali HC mengedit pemetaan."
      >
        <Link href="/analisa" className="btn-secondary">
          Analisa kamus →
        </Link>
      </PageHeader>
      <Suspense fallback={<DashboardSkeleton label="Memuat kualitas pemetaan" />}>
        <Kualitas />
      </Suspense>
    </>
  );
}

async function Kualitas() {
  const {
    profil, teknis, tidakDipakai, belumFinal, perBidang, sebaran, terpopuler, perUnit, maxKompUnit, grupNama, namaKompetensi, pelaksanaLC,
    strukturalTanpaLC, tanpaTeknis, outlier, aturan, celahPerJabatan, celahPerUnit, temuan, bersih, prioritas, ringkas, cekAman, atasan, levelKamus,
    celah, totalTugas,
  } = await loadKualitas();

  return (
    <div className="space-y-6">
      <Hero total={profil.length} bersih={bersih} ringkas={ringkas} cekAman={cekAman} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon="M4 3.5h9.5a2 2 0 0 1 2 2v11H6a2 2 0 0 1-2-2zM4 14.5a2 2 0 0 1 2-2h9.5M7.5 7h5"
          label="Kamus teknis terpakai"
          value={<Hitung n={persen(teknis.length - tidakDipakai.length, teknis.length)} akhiran="%" />}
          hint={`${fmt(teknis.length - tidakDipakai.length)} dari ${fmt(teknis.length)} kompetensi dipakai ≥1 jabatan`}
          href="#tidak-dipakai"
          aksen={tidakDipakai.length ? "amber" : "emerald"}
        >
          <Batang
            className="mt-2"
            bagian={[
              { n: teknis.length - tidakDipakai.length, kelas: "bg-brand-600", label: "dipakai" },
              { n: tidakDipakai.length, kelas: "bg-amber-400", label: "tidak dipakai" },
            ]}
          />
        </Stat>
        <Stat
          icon="M4.5 5.5l1.5 1.5 2.5-3M4.5 11l1.5 1.5 2.5-3M11 5.5h5M11 11h5M4.5 16h11.5"
          label="Tugas tercakup kamus"
          value={totalTugas ? <Hitung n={persen(totalTugas - celah.length, totalTugas)} akhiran="%" /> : "—"}
          hint={`${fmt(celah.length)} butir tugas inti ditandai tanpa padanan, dari ${fmt(totalTugas)} butir`}
          href="#celah"
          aksen={celah.length ? "amber" : "emerald"}
        >
          <Batang
            className="mt-2"
            bagian={[
              { n: totalTugas - celah.length, kelas: "bg-emerald-500", label: "tercakup" },
              { n: celah.length, kelas: "bg-amber-400", label: "tanpa padanan" },
            ]}
          />
        </Stat>
        <Stat
          icon="M7 6a3.5 3.5 0 1 0 0 7M13 7a3.5 3.5 0 1 1 0 7"
          label="Konsistensi nama sama"
          value={grupNama.length ? `${grupNama.length} grup` : "Konsisten"}
          hint={grupNama.length ? `${fmt(grupNama.reduce((s, g) => s + g.ps.length, 0))} jabatan · ${fmt(grupNama.reduce((s, g) => s + g.beda.length, 0))} kompetensi berbeda` : "Semua jabatan sama nama berprofil sama"}
          href="#nama-sama"
          aksen={grupNama.length ? "amber" : "emerald"}
        />
        <Stat
          icon="M10 3 2.5 16.5h15zM10 8v4M10 14.3v.2"
          label="Jabatan dengan temuan"
          value={<Hitung n={temuan.size} />}
          hint={`${persen(temuan.size, profil.length)}% dari ${fmt(profil.length)} jabatan karyawan`}
          href="#prioritas"
          aksen={temuan.size ? "amber" : "emerald"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Mulai dari sini — jabatan dengan temuan terbanyak" className="xl:col-span-2">
          <div id="prioritas" className="scroll-mt-6">
            {prioritas.length === 0 ? (
              <Aman />
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {prioritas.map(({ p, cek: cs }) => (
                  <li key={p.kode}>
                    <Link href={`/jabatan/${p.kode}`} className="group flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 hover:bg-slate-50">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-50 text-xs font-semibold tabular-nums text-amber-800 ring-1 ring-amber-200">
                        {cs.length}
                      </span>
                      <span className="min-w-0 flex-[1_1_12rem]">
                        <span className="block font-medium text-slate-900 group-hover:text-brand-700">{p.nama}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {p.unit_induk_nama} · {JENJANG_LABEL[p.jenjang]}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {cs.map((c) => (
                          <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                            {c}
                          </span>
                        ))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {temuan.size > prioritas.length && (
              <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">+ {temuan.size - prioritas.length} jabatan lain dengan temuan; rinciannya di tiap bagian di bawah.</p>
            )}
          </div>
        </Card>

        <Card title="Seberapa luas kompetensi teknis dipakai">
          <div className="p-4">
            <div className="flex h-32 items-end gap-2">
              {sebaran.map((s, i) => {
                const maxN = Math.max(1, ...sebaran.map((x) => x.n));
                return (
                  <div key={s.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs font-semibold tabular-nums text-slate-700">{s.n}</span>
                    <div
                      className={`w-full origin-bottom animate-[naik_0.7s_ease-out_both] rounded-t-md ${s.kelas}`}
                      style={{ height: `${(s.n / maxN) * 80}%`, animationDelay: `${i * 70}ms` }}
                      title={`${s.n} kompetensi dipakai ${s.label} jabatan`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-2 border-t border-slate-200 pt-1.5">
              {sebaran.map((s) => (
                <span key={s.label} className="flex-1 text-center text-[11px] font-medium text-slate-500">
                  {s.label}
                </span>
              ))}
            </div>
            <p className="mt-0.5 text-center text-[11px] text-slate-400">jumlah jabatan pemakai per kompetensi</p>
            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Paling banyak dipakai</h3>
            <ol className="space-y-1.5 text-sm">
              {terpopuler.map((k) => (
                <li key={k.kode} className="flex items-baseline gap-2">
                  <Link href={`/kompetensi/${k.kode}`} className="min-w-0 flex-1 truncate text-slate-700 hover:text-brand-700" title={k.nama ?? ""}>
                    <span className="mr-1.5 font-mono text-xs text-slate-400">{k.kode}</span>
                    {k.nama}
                  </Link>
                  <span className="shrink-0 text-xs tabular-nums text-slate-600">{k.jumlah_jabatan} jabatan</span>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </div>

      <Bagian judul="Cakupan kamus" desc="Apakah kamus memenuhi kebutuhan jabatan, dan bagian kamus mana yang belum terpakai." />

      <Card title={`Pemakaian kompetensi teknis per bidang · ${tidakDipakai.length} tidak dipakai`}>
        <div id="tidak-dipakai" className="scroll-mt-6">
          <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            Buka bidang untuk melihat kompetensi yang belum dipakai jabatan mana pun: mungkin belum ada jabatan yang membutuhkannya, tumpang tindih dengan kompetensi
            lain, atau pemetaannya terlewat.
            {belumFinal.length > 0 && <> Tidak termasuk {belumFinal.length} kompetensi yang belum final ({belumFinal.map((k) => `${k.kode} ${k.status}`).join(", ")}).</>}
          </p>
          <div className="divide-y divide-slate-100">
            {perBidang.map((b) => (
              <details key={b.kode} className="group">
                <summary className={`grid list-none items-center gap-x-4 gap-y-1.5 px-4 py-2.5 sm:grid-cols-[minmax(0,16rem)_1fr_7rem] ${b.kosong.length ? "cursor-pointer hover:bg-slate-50" : "pointer-events-none"} [&::-webkit-details-marker]:hidden`}>
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className={`size-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-90 ${b.kosong.length ? "" : "invisible"}`} aria-hidden>
                      <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="font-mono text-xs text-slate-500">{b.kode}</span>
                    <span className="truncate font-medium text-slate-800" title={b.nama}>
                      {b.nama}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex h-2 flex-1 gap-px overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full origin-left animate-[tumbuh_0.8s_ease-out_both] bg-gradient-to-r from-brand-700 to-brand-400" style={{ width: `${(b.dipakai / b.total) * 100}%` }} />
                      {b.kosong.length > 0 && <span className="block h-full bg-amber-300" style={{ width: `${(b.kosong.length / b.total) * 100}%` }} />}
                    </span>
                    <span className="w-14 text-right text-xs tabular-nums text-slate-600">
                      {b.dipakai}/{b.total}
                    </span>
                  </span>
                  <span className="text-right text-xs tabular-nums text-slate-500">{b.jabatanPemakai} jabatan</span>
                </summary>
                {b.kosong.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-4 pb-3 pl-10">
                    {b.kosong.map((k) => (
                      <Link
                        key={k.kode}
                        href={`/kompetensi/${k.kode}`}
                        className="rounded-md bg-amber-50/60 px-2 py-1 text-xs text-slate-700 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-brand-50 hover:text-brand-800"
                      >
                        <span className="font-mono text-slate-500">{k.kode}</span> {k.nama}
                      </Link>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card title={`Tugas inti tanpa padanan kamus · ${celah.length} butir`} className="xl:col-span-3">
          <div id="celah" className="scroll-mt-6">
            <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              Hasil analisis AI atas jobdesk: tugas inti yang tidak terwakili kompetensi teknis mana pun di kamus. Bahan untuk menambah atau memperluas kompetensi
              saat review kamus.
            </p>
            {celahPerJabatan.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500">Belum ada data (analisis AI belum dijalankan untuk jobdesk ini).</p>
            ) : (
              <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:divide-x md:divide-y-0">
                <div className="p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Per unit</h3>
                  <ul className="space-y-2.5 text-sm">
                    {celahPerUnit.slice(0, 10).map((u, i) => (
                      <li key={u.unit}>
                        <div className="mb-1 flex justify-between gap-2">
                          <span className="min-w-0 truncate text-slate-700" title={u.unit}>
                            {u.unit}
                          </span>
                          <span className="shrink-0 tabular-nums text-slate-600">{u.butir}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-1.5 origin-left animate-[tumbuh_0.8s_ease-out_both] rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                            style={{ width: `${(u.butir / celahPerUnit[0].butir) * 100}%`, animationDelay: `${i * 50}ms` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                  {celahPerUnit.length > 10 && <p className="mt-3 text-xs text-slate-500">+ {celahPerUnit.length - 10} unit lain</p>}
                </div>
                <div className="max-h-[30rem] divide-y divide-slate-100 overflow-auto">
                  {celahPerJabatan.map((g) => (
                    <div key={g.kode} className="px-4 py-3">
                      <Link href={`/jabatan/${g.kode}`} className="text-sm font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {g.nama}
                      </Link>
                      <span className="ml-2 text-xs text-slate-500">{g.unit}</span>
                      <ul className="mt-1 space-y-0.5 text-[13px] text-slate-700">
                        {g.ts.map((t) => (
                          <li key={t.id}>
                            <span className="mr-1.5 tabular-nums text-slate-400">{t.urutan}.</span>
                            {t.deskripsi}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Kebutuhan kompetensi teknis per divisi / kantor" className="xl:col-span-2">
          <ul className="max-h-[36rem] divide-y divide-slate-50 overflow-auto text-sm">
            {[...perUnit]
              .sort((a, b) => b.kompetensi - a.kompetensi)
              .map((u) => (
                <li key={u.unit} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={`/matriks?${new URLSearchParams({ unit: u.unit, kategori: "teknis" })}`} className="min-w-0 truncate text-slate-800 hover:text-brand-700 hover:underline" title={u.unit}>
                      {u.unit}
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      <b className="font-semibold text-slate-800">{u.kompetensi}</b> komp. · {u.jabatan} jab.
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-sky-400" style={{ width: `${(u.kompetensi / maxKompUnit) * 100}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {u.bidang.map((b) => (
                        <span key={b} className="rounded bg-sky-50 px-1.5 py-px font-mono text-[10px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      </div>

      <Bagian judul="Konsistensi pemetaan" desc="Apakah pemetaan masuk akal antar jabatan: sesama nama, atasan–bawahan, aturan dasar, dan rekan sejenjang." />

      <Card title={`Jabatan bernama sama dengan profil kompetensi berbeda (${grupNama.length})`}>
        <div id="nama-sama" className="scroll-mt-6">
          <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            Jabatan dengan nama sama di divisi/kantor berbeda. Perbedaan bisa memang disengaja (mis. Teller di Capem Tower vs Non SME), tetapi sebaiknya diputuskan
            secara sadar. Batang = porsi kompetensi yang sama di semua jabatan. &quot;–&quot; = kompetensi tidak dipetakan untuk jabatan itu.
          </p>
          {grupNama.length === 0 && <Aman />}
          <div className="divide-y divide-slate-200">
            {grupNama.map((g) => (
              <details key={g.nama} className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" aria-hidden>
                    <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="font-medium text-slate-900">{g.nama}</span>
                  <span className="text-xs text-slate-500">{g.ps.length} jabatan</span>
                  <span className="ml-auto flex items-center gap-2 text-xs">
                    <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-amber-300 sm:block" title={`${persen(g.sama, g.sama + g.beda.length)}% kompetensi sama`}>
                      <span className="block h-full bg-emerald-500" style={{ width: `${persen(g.sama, g.sama + g.beda.length)}%` }} />
                    </span>
                    <span className="w-10 text-right font-semibold tabular-nums text-slate-700">{persen(g.sama, g.sama + g.beda.length)}%</span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">{g.beda.length} beda</span>
                  </span>
                </summary>
                <div className="overflow-x-auto px-4 pb-4">
                  <table className="text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-1.5 pr-4 font-medium">Kompetensi yang berbeda</th>
                        {g.ps.map((p) => (
                          <th key={p.id} className="min-w-28 px-2 py-1.5 text-center font-medium">
                            <Link href={`/jabatan/${p.kode}/edit#kompetensi`} className="hover:text-brand-700 hover:underline" title="Edit pemetaan jabatan ini">
                              {p.unit_induk_nama}
                            </Link>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.beda.map((k) => (
                        <tr key={k} className="border-t border-slate-100">
                          <td className="py-1.5 pr-4">
                            <span className="mr-1.5 font-mono text-slate-500">{k}</span>
                            <span className="text-slate-700">{namaKompetensi.get(k)}</span>
                          </td>
                          {g.peta.map((m, i) => {
                            const lv = m.get(k);
                            return (
                              <td key={i} className="px-2 py-1 text-center">
                                {lv ? <span className={`inline-block min-w-6 rounded px-1.5 py-0.5 lv${lv}`}>{lv}</span> : <span className="text-slate-300">–</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Level bawahan lebih tinggi dari atasan" action={<Hasil n={atasan.length} />}>
          <div id="atasan" className="scroll-mt-6">
            <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">Untuk kompetensi yang sama, atasan umumnya ditargetkan minimal setara bawahannya.</p>
            {atasan.length === 0 ? (
              <Aman />
            ) : (
              <ul className="divide-y divide-slate-50 text-sm">
                {atasan.map((r) => (
                  <li key={`${r.jabatan_kode}-${r.kompetensi_kode}`} className="px-4 py-2">
                    <Link href={`/jabatan/${r.jabatan_kode}/edit#kompetensi`} className="font-medium hover:underline">
                      {r.jabatan_nama}
                    </Link>{" "}
                    <span className="text-slate-500">
                      level {r.level_bawahan} vs atasan {r.atasan_nama} level {r.level_atasan} · {r.kompetensi_kode}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card title="Aturan dasar" action={<Hasil n={aturan + levelKamus.length} />}>
          <div id="aturan" className="scroll-mt-6 divide-y divide-slate-100">
            <Aturan judul="Pelaksana mendapat kompetensi kepemimpinan" items={pelaksanaLC.map((p) => ({ kode: p.kode, teks: `${p.nama} · ${p.unit_induk_nama}` }))} />
            <Aturan judul="Jabatan struktural tanpa kompetensi kepemimpinan" items={strukturalTanpaLC.map((p) => ({ kode: p.kode, teks: `${p.nama} · ${p.unit_induk_nama}` }))} />
            <Aturan judul="Jabatan tanpa kompetensi teknis" items={tanpaTeknis.map((p) => ({ kode: p.kode, teks: `${p.nama} · ${p.unit_induk_nama}` }))} />
            <Aturan
              judul="Level target melebihi level yang tersedia di kamus"
              items={levelKamus.map((r) => ({
                kode: r.jabatan_kode!,
                teks: `${r.jabatan_nama} · ${r.kompetensi_kode} level ${r.level_target} (kamus s.d. ${r.level_tersedia ?? 0})`,
              }))}
            />
          </div>
        </Card>
      </div>

      <Card title="Profil menyimpang dari jabatan sejenjang" action={<Hasil n={outlier.length} />}>
        <div id="outlier" className="scroll-mt-6">
          <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            Jumlah kompetensi atau rata-rata level target yang jauh di luar kebiasaan jabatan sejenjang (aturan IQR). Selama pemetaan masih draf otomatis yang seragam,
            bagian ini biasanya kosong.
          </p>
          {outlier.length === 0 ? (
            <Aman />
          ) : (
            <ul className="divide-y divide-slate-50 text-sm">
              {outlier.map(({ p, alasan }) => (
                <li key={`${p.kode}-${alasan}`} className="flex flex-wrap gap-2 px-4 py-2">
                  <Link href={`/jabatan/${p.kode}`} className="font-medium hover:underline">
                    {p.nama}
                  </Link>
                  <span className="text-slate-500">
                    {p.unit_induk_nama} · {JENJANG_LABEL[p.jenjang]}
                  </span>
                  <span className="ml-auto text-amber-800">{alasan}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function Hero({ total, bersih, ringkas, cekAman }: { total: number; bersih: number; ringkas: { href: string; label: string; nilai: string; n: number }[]; cekAman: number }) {
  const p = persen(bersih, total);
  const r = 52;
  const keliling = 2 * Math.PI * r;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900" aria-label="Ringkasan kualitas pemetaan">
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
                stroke="url(#kualitas-ring)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={keliling}
                strokeDashoffset={keliling * (1 - p / 100)}
                className="animate-[lingkar_1.1s_ease-out_both]"
                style={{ "--penuh": keliling } as React.CSSProperties}
              />
              <defs>
                <linearGradient id="kualitas-ring" x1="0" y1="0" x2="1" y2="1">
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
                <div className="text-[11px] uppercase tracking-wide text-brand-200">tanpa temuan</div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Kualitas pemetaan</div>
            <p className="mt-1.5 font-heading text-xl font-medium leading-snug">
              {fmt(bersih)} dari {fmt(total)} jabatan
              <span className="text-brand-200"> lolos semua cek. {cekAman} dari {ringkas.length} cek tanpa temuan.</span>
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-1 content-center gap-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
          {ringkas.map((x, i) => (
            <li key={x.href}>
              <a
                href={x.href}
                className="group flex h-full animate-[masuk_0.45s_ease-out_both] flex-col rounded-xl bg-white/[0.06] p-3.5 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                style={{ animationDelay: `${150 + i * 60}ms` }}
              >
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span className={`size-2 rounded-full ${x.n ? "bg-amber-400 shadow-[0_0_8px] shadow-amber-400/70" : "bg-emerald-400"}`} aria-hidden />
                  <span className={x.n ? "text-amber-300" : "text-emerald-300"}>{x.n ? "Perlu dicek" : "Aman"}</span>
                </span>
                <span className="mt-1.5 font-heading text-2xl font-semibold tabular-nums">{x.nilai}</span>
                <span className="mt-0.5 text-[13px] leading-snug text-brand-200 group-hover:text-white">{x.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Bagian({ judul, desc }: { judul: string; desc: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-semibold text-slate-900">{judul}</h2>
      <p className="text-sm text-slate-500">{desc}</p>
    </div>
  );
}

function Hasil({ n }: { n: number }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${n ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
      {n ? `${n} temuan` : "aman"}
    </span>
  );
}

function Aman() {
  return (
    <p className="flex items-center gap-2 px-4 py-4 text-sm text-emerald-700">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4" aria-hidden>
        <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Tidak ada temuan.
    </p>
  );
}

function Aturan({ judul, items }: { judul: string; items: { kode: string; teks: string }[] }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-800">{judul}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${items.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
          {items.length || "aman"}
        </span>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1 text-[13px]">
          {items.map((it) => (
            <li key={it.kode + it.teks}>
              <Link href={`/jabatan/${it.kode}/edit#kompetensi`} className="text-brand-700 hover:underline">
                {it.teks}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

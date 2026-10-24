import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Batang, Card, Empty, PdfLink, Stat, Tag } from "@/components/ui";
import { JabatanDetailSkeleton } from "@/components/skeleton";
import { penggunaSaatIni } from "@/lib/auth";
import { loadProfil, type Profil } from "@/lib/kedekatan";
import { JENJANG_LABEL, KATEGORI_LABEL, LEVEL_NAMA } from "@/lib/labels";
import { bolehEdit } from "@/lib/peran";
import { must, supabase } from "@/lib/supabase";
import { JalurCard } from "./jalur-card";
import { ReviewPanel } from "./review-panel";

export default function Page(props: PageProps<"/jabatan/[kode]">) {
  return (
    <>
      <Link href="/jabatan" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Daftar Jabatan
      </Link>
      <Suspense fallback={<JabatanDetailSkeleton />}>
        <Detail params={props.params} />
      </Suspense>
    </>
  );
}

const KATEGORI_WARNA: Record<string, string> = { inti: "bg-brand-700", kepemimpinan: "bg-amber-400", teknis: "bg-sky-400" };
// kompetensi teknis yang dimiliki < KHAS jabatan pembanding dianggap ciri khas jabatan ini
const KHAS = 0.15;
// pembanding minimal; bila rumpun (kantor pusat / jaringan kantor) terlalu kecil, pakai semua jabatan sejenjang
const MIN_PEMBANDING = 5;

const des = (n: number, d = 1) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const rata = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

async function Detail({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const j = await supabase.from("v_jabatan").select("*").eq("kode", decodeURIComponent(kode)).maybeSingle().then(must);
  if (!j) notFound();

  const [bawahan, kompetensi, sejenis, semua, saya, jobdesk] = await Promise.all([
    supabase.from("v_jabatan").select("kode, nama, kelompok_jabatan, jumlah_kompetensi").eq("atasan_id", j.id!).order("urutan").then(must),
    supabase
      .from("v_jabatan_kompetensi")
      .select("kompetensi_kode, kompetensi_nama, bidang_kode, kategori, level_target, nama_level, sumber, skor, catatan, metode, bukti")
      .eq("jabatan_id", j.id!)
      .order("kompetensi_kode")
      .then(must),
    supabase.from("v_jabatan").select("kode, unit_induk_nama").eq("nama", j.nama!).neq("kode", j.kode!).then(must),
    (j.jenjang ?? 0) > 0 ? loadProfil() : Promise.resolve(new Map<number, Profil>()),
    penggunaSaatIni(),
    // dokumen jobdesk utama (urutan terkecil) = sumber uraian_tugas & nomor bukti
    supabase
      .from("jobdesk")
      .select("jobdesk_tugas(urutan, tanpa_kompetensi, alasan_tanpa_kode, saran_kompetensi, catatan_tanpa_kode)")
      .eq("jabatan_id", j.id!)
      .order("urutan")
      .limit(1)
      .maybeSingle()
      .then(must),
  ]);

  // pembanding: jabatan lain sejenjang yang sudah punya pemetaan, dalam rumpun yang sama — kantor pusat (punya
  // direktorat) atau jaringan kantor — supaya mis. Teller dibandingkan dengan pelaksana kantor cabang, bukan divisi
  const semuaSejenjang = [...semua.values()].filter((p) => p.jenjang === j.jenjang && p.id !== j.id && p.kompetensi.size > 0);
  const pusat = !!j.direktorat;
  const serumpun = semuaSejenjang.filter((p) => !!p.direktorat === pusat);
  const sejenjang = serumpun.length >= MIN_PEMBANDING ? serumpun : semuaSejenjang;
  const lingkup = `${JENJANG_LABEL[j.jenjang ?? 4]}${sejenjang === serumpun ? (pusat ? " kantor pusat" : " jaringan kantor") : ""}`;
  const pakaiSejenjang = (kode: string) => {
    const punya = sejenjang.filter((p) => p.kompetensi.has(kode));
    return { share: sejenjang.length ? punya.length / sejenjang.length : 0, level: rata(punya.map((p) => p.kompetensi.get(kode)!.level)) };
  };
  const rataKompSejenjang = rata(sejenjang.map((p) => p.kompetensi.size));
  const rataLevelSejenjang = rata(sejenjang.map((p) => rata([...p.kompetensi.values()].map((k) => k.level))));
  const levelSaya = rata(kompetensi.map((k) => k.level_target ?? 0));

  // butir tugas → kompetensi teknis yang menjadikannya bukti
  const tugas = j.uraian_tugas ?? [];
  const pendukung = new Map<number, string[]>();
  for (const k of kompetensi) for (const n of k.bukti ?? []) pendukung.set(n, [...(pendukung.get(n) ?? []), k.kompetensi_kode!]);
  const tercakup = tugas.filter((_, i) => pendukung.has(i + 1)).length;
  // butir tanpa kode → alasannya (analisis AI per butir); fallback: celah kamus bila ditandai, selain itu tugas umum
  const struktural = kompetensi.some((k) => k.kategori === "kepemimpinan");
  const butir = new Map((jobdesk?.jobdesk_tugas ?? []).map((t) => [t.urutan, t]));
  const alasanTanpaKode = (n: number): Alasan => {
    const t = butir.get(n);
    const jenis = (t?.alasan_tanpa_kode ?? (t?.tanpa_kompetensi ? "celah" : struktural ? "kepemimpinan" : "umum")) as Alasan["jenis"];
    return { jenis, saran: t?.saran_kompetensi ?? [], catatan: t?.catatan_tanpa_kode ?? null };
  };
  const dianalisis = kompetensi.some((k) => k.metode === "ai");
  const jumlahCelah = tugas.filter((_, i) => !pendukung.has(i + 1) && alasanTanpaKode(i + 1).jenis === "celah").length;

  const khas = kompetensi.filter((k) => k.kategori === "teknis" && sejenjang.length && pakaiSejenjang(k.kompetensi_kode!).share < KHAS);
  const campuran = KATEGORI.map(([k]) => ({ n: kompetensi.filter((x) => x.kategori === k).length, kelas: KATEGORI_WARNA[k], label: KATEGORI_LABEL[k].toLowerCase() }));
  const karyawan = (j.jenjang ?? 0) > 0;

  return (
    <article className="space-y-6">
      <Hero j={j} bawahan={bawahan.length} kompetensi={kompetensi.length} campuran={campuran} levelSaya={levelSaya} bisaEdit={bolehEdit(saya?.peran)} />

      {karyawan && kompetensi.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon="M3.5 3.5h13v13h-13zM3.5 8h13M3.5 12.5h13M8 3.5v13M12.5 3.5v13"
            label="Kompetensi"
            value={kompetensi.length}
            hint={<Banding nilai={kompetensi.length} pembanding={rataKompSejenjang} satuan="" lingkup={lingkup} />}
          >
            <Batang className="mt-2" bagian={campuran} />
          </Stat>
          <Stat
            icon="M3.5 16.5h13M6 13.5V11M10 13.5V8M14 13.5V5"
            label="Level target rata-rata"
            value={`L${des(levelSaya)}`}
            hint={<Banding nilai={levelSaya} pembanding={rataLevelSejenjang} satuan="L" lingkup={lingkup} />}
          />
          <Stat
            icon="M4.5 5.5l1.5 1.5 2.5-3M4.5 11l1.5 1.5 2.5-3M11 5.5h5M11 11h5M4.5 16h11.5"
            label="Tugas didukung kompetensi"
            value={tugas.length ? `${tercakup}/${tugas.length}` : "—"}
            hint={
              tugas.length
                ? tercakup === tugas.length
                  ? "Semua butir tugas punya kompetensi teknis"
                  : `${tugas.length - tercakup} butir tanpa kode${jumlahCelah ? `, ${jumlahCelah} di antaranya celah kamus` : ""}`
                : "Jobdesk belum tersedia"
            }
            aksen={tugas.length && tercakup < tugas.length ? "amber" : "emerald"}
          >
            {tugas.length > 0 && (
              <Batang
                className="mt-2"
                bagian={[
                  { n: tercakup, kelas: "bg-emerald-500", label: "didukung" },
                  { n: tugas.length - tercakup, kelas: "bg-amber-400", label: "tanpa bukti" },
                ]}
              />
            )}
          </Stat>
          <Stat
            icon="M10 3.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z"
            label="Kompetensi khas"
            value={khas.length}
            hint={
              khas.length
                ? `Jarang di ${lingkup}: ${khas.map((k) => k.kompetensi_kode).join(", ")}`
                : `Profil teknis lazim untuk ${lingkup}`
            }
          />
        </div>
      )}

      {karyawan && <ReviewPanel jabatanId={j.id!} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Posisi dalam struktur" className="lg:col-span-1">
          <OrgSnippet j={j} bawahan={bawahan} />
          <dl className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
            <Row label="Unit kerja">{j.unit_nama}</Row>
            <Row label="Divisi / kantor">{j.unit_induk_nama}</Row>
            <Row label="Direktorat">{j.direktorat ?? "—"}</Row>
          </dl>
          {j.catatan && <p className="border-t border-slate-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">{j.catatan}</p>}
          {sejenis.length > 0 && (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              Jabatan dengan nama sama juga ada di:{" "}
              {sejenis.map((s, i) => (
                <span key={s.kode}>
                  {i > 0 && ", "}
                  <Link href={`/jabatan/${s.kode}`} className="link">
                    {s.unit_induk_nama}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </Card>

        <Card
          title="Uraian jabatan (jobdesk)"
          className="lg:col-span-2"
          action={tugas.length > 0 && <span className="text-xs text-slate-500">Kode di kanan = kompetensi teknis yang didukung butir tugas{dianalisis && "; tanpa kode = alasannya"}</span>}
        >
          {j.ikhtisar_jabatan || tugas.length > 0 ? (
            <div className="space-y-4 p-4 text-sm">
              {j.ikhtisar_jabatan && (
                <p className="rounded-lg border-l-4 border-brand-500 bg-brand-50/50 px-4 py-3 leading-relaxed text-slate-800">{j.ikhtisar_jabatan}</p>
              )}
              <ol className="space-y-1">
                {tugas.map((t, i) => {
                  const ks = pendukung.get(i + 1) ?? [];
                  return (
                    <li key={i} className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 hover:bg-slate-50 sm:flex-nowrap">
                      <span
                        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums ${
                          ks.length ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 leading-relaxed text-slate-700">{t}</span>
                      {ks.length > 0 ? (
                        <span className="flex basis-full flex-wrap gap-1 self-start pl-8 sm:basis-auto sm:shrink-0 sm:justify-end sm:pl-0">
                          {ks.map((k) => (
                            <a key={k} href={`#k-${k}`} className="rounded bg-sky-50 px-1.5 py-px font-mono text-[11px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200 hover:bg-sky-100">
                              {k}
                            </a>
                          ))}
                        </span>
                      ) : (
                        dianalisis && (
                          <span className="flex basis-full self-start pl-8 sm:basis-auto sm:shrink-0 sm:pl-0">
                            <AlasanTanpaKode {...alasanTanpaKode(i + 1)} />
                          </span>
                        )
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="p-4">
              <Empty>Jobdesk belum tersedia. Kolom ikhtisar_jabatan & uraian_tugas sudah disiapkan di tabel jabatan.</Empty>
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Kompetensi yang dibutuhkan"
        action={
          <span className="flex flex-wrap items-center gap-3">
            {sejenjang.length > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="h-3 w-0.5 rounded bg-amber-500" aria-hidden />
                rata-rata {lingkup}
              </span>
            )}
            {kompetensi.some((k) => k.sumber === "usulan") && <Tag title="Draf otomatis — perlu direview HC">Usulan otomatis</Tag>}
          </span>
        }
      >
        {kompetensi.length ? (
          <table className="w-full text-sm">
            {KATEGORI.map(([kat, label]) => {
              const rows = kompetensi.filter((k) => k.kategori === kat).sort((a, b) => (b.skor ?? 0) - (a.skor ?? 0));
              return (
                rows.length > 0 && (
                  <tbody key={kat}>
                    <tr>
                      <th colSpan={4} className="bg-slate-50 px-4 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                        <span className="flex items-center gap-2">
                          <span className={`size-2.5 rounded-sm ${KATEGORI_WARNA[kat]}`} aria-hidden />
                          {label}
                          <span className="font-normal normal-case tracking-normal text-slate-400">· {rows.length}</span>
                        </span>
                      </th>
                    </tr>
                    {rows.map((k) => {
                      const banding = sejenjang.length ? pakaiSejenjang(k.kompetensi_kode!) : null;
                      return (
                        <tr key={k.kompetensi_kode} id={`k-${k.kompetensi_kode}`} className="scroll-mt-6 border-b border-slate-50 align-top last:border-0 target:bg-sky-50/60">
                          <td className="w-20 px-4 py-2.5 font-mono text-xs text-slate-500">{k.kompetensi_kode}</td>
                          <td className="py-2.5 pr-3">
                            <Link href={`/kompetensi/${k.kompetensi_kode}`} className="font-medium text-slate-800 hover:text-brand-700 hover:underline">
                              {k.kompetensi_nama}
                            </Link>
                            {banding && kat === "teknis" && (
                              <span
                                className={`ml-2 inline-flex rounded-full px-2 py-px text-[11px] font-semibold ring-1 ring-inset ${
                                  banding.share < KHAS ? "bg-violet-50 text-violet-700 ring-violet-200" : "bg-slate-50 text-slate-500 ring-slate-200"
                                }`}
                                title={`Dimiliki ${Math.round(banding.share * 100)}% jabatan ${lingkup} lain`}
                              >
                                {banding.share < KHAS && "khas · "}
                                {Math.round(banding.share * 100)}% sejenjang
                              </span>
                            )}
                            {k.kategori === "teknis" && <Bukti alasan={k.catatan} metode={k.metode} bukti={k.bukti ?? []} tugas={tugas} />}
                          </td>
                          <td className="w-24 py-3">
                            <LevelMeter level={k.level_target ?? 0} sejenjang={banding?.level ?? 0} lingkup={lingkup} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-slate-600">
                            <span className="font-semibold text-slate-800">L{k.level_target}</span> · {k.nama_level ?? LEVEL_NAMA[(k.level_target ?? 1) - 1]}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                )
              );
            })}
          </table>
        ) : (
          <div className="p-4">
            <Empty>Belum ada pemetaan kompetensi untuk jabatan ini (tabel jabatan_kompetensi).</Empty>
          </div>
        )}
      </Card>

      {karyawan && <JalurCard jabatanId={j.id!} kode={j.kode!} />}
    </article>
  );
}

type Jabatan = {
  kode: string | null;
  nama: string | null;
  nama_asli: string | null;
  kelompok_jabatan: string | null;
  jenjang: number | null;
  unit_nama: string | null;
  unit_induk_nama: string | null;
  direktorat: string | null;
  atasan_kode: string | null;
  atasan_nama: string | null;
};

function Hero({
  j,
  bawahan,
  kompetensi,
  campuran,
  levelSaya,
  bisaEdit,
}: {
  j: Jabatan;
  bawahan: number;
  kompetensi: number;
  campuran: { n: number; kelas: string; label: string }[];
  levelSaya: number;
  bisaEdit: boolean;
}) {
  const jalur = [j.direktorat, j.unit_induk_nama, j.unit_nama !== j.unit_induk_nama ? j.unit_nama : null].filter(Boolean);
  return (
    <header className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900">
      {/* cahaya dekoratif */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-brand-100 ring-1 ring-white/15">{j.kode}</span>
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-300 ring-1 ring-amber-300/30">{j.kelompok_jabatan}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-brand-100 ring-1 ring-white/15">
              Jenjang {j.jenjang} · {JENJANG_LABEL[j.jenjang ?? 4]}
            </span>
          </div>
          <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">{j.nama}</h1>
          {j.nama_asli && j.nama_asli.toLowerCase() !== j.nama?.toLowerCase() && <p className="mt-1 text-sm text-brand-200">Tertulis di bagan: {j.nama_asli}</p>}
          {jalur.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-brand-200">
              {jalur.map((x, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-brand-400" aria-hidden>›</span>}
                  {x}
                </span>
              ))}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <PdfLink href={`/dokumen/jobdesk/${j.kode}`} className="btn h-9 bg-white/10 text-[13px] text-white ring-1 ring-white/15 hover:bg-white/15">
              Uraian tugas (PDF)
            </PdfLink>
            {bisaEdit && (
              <Link href={`/jabatan/${j.kode}/edit`} className="btn h-9 bg-amber-400 text-[13px] text-brand-950 shadow-sm hover:bg-amber-300">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-4" aria-hidden>
                  <path d="M12.5 4.5l3 3L8 15H5v-3z" strokeLinejoin="round" />
                </svg>
                Edit jabatan, jobdesk & kompetensi
              </Link>
            )}
          </div>
        </div>

        {kompetensi > 0 && (
          <dl className="grid shrink-0 grid-cols-3 gap-2 lg:w-[22rem]">
            <Fakta label="Kompetensi" nilai={kompetensi} />
            <Fakta label="Level rata-rata" nilai={`L${des(levelSaya)}`} />
            <Fakta label="Bawahan" nilai={bawahan} />
            <div className="col-span-3 rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10">
              <dt className="sr-only">Komposisi kompetensi</dt>
              <dd>
                <span className="flex h-2 gap-px overflow-hidden rounded-full bg-white/10">
                  {campuran.map((c) => c.n > 0 && <span key={c.label} className={`block origin-left animate-[tumbuh_0.8s_ease-out_both] ${c.kelas}`} style={{ width: `${(c.n / kompetensi) * 100}%` }} />)}
                </span>
                <span className="mt-1.5 flex justify-between gap-2 text-[11px] text-brand-200">
                  {campuran.filter((c) => c.n > 0).map((c) => (
                    <span key={c.label} className="flex items-center gap-1">
                      <span className={`size-2 rounded-sm ${c.kelas}`} aria-hidden />
                      {c.n} {c.label}
                    </span>
                  ))}
                </span>
              </dd>
            </div>
          </dl>
        )}
      </div>
    </header>
  );
}

function Fakta({ label, nilai }: { label: string; nilai: React.ReactNode }) {
  return (
    <div className="animate-[masuk_0.45s_ease-out_both] rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10">
      <dt className="text-[11px] uppercase tracking-wide text-brand-200">{label}</dt>
      <dd className="font-heading text-2xl font-semibold tabular-nums">{nilai}</dd>
    </div>
  );
}

/** "+1,2 di atas rata-rata Pelaksana jaringan kantor" dsb. */
function Banding({ nilai, pembanding, satuan, lingkup }: { nilai: number; pembanding: number; satuan: string; lingkup: string }) {
  if (!pembanding) return <>Belum ada pembanding sejenjang</>;
  const selisih = nilai - pembanding;
  const sama = Math.abs(selisih) < 0.05;
  return (
    <>
      {sama ? "Sama dengan" : <b className={selisih > 0 ? "text-brand-700" : "text-slate-700"}>{`${selisih > 0 ? "+" : "−"}${des(Math.abs(selisih))} ${selisih > 0 ? "di atas" : "di bawah"}`}</b>}{" "}
      rata-rata {lingkup} ({satuan}
      {des(pembanding)})
    </>
  );
}

/** Lima segmen level; terisi sampai level target, garis amber = rata-rata level jabatan pembanding yang memakai kompetensi ini. */
function LevelMeter({ level, sejenjang, lingkup }: { level: number; sejenjang: number; lingkup: string }) {
  return (
    <span className="relative flex w-20 gap-0.5" title={sejenjang ? `Target L${level} · rata-rata ${lingkup} L${des(sejenjang)}` : `Target L${level}`}>
      {[1, 2, 3, 4, 5].map((l) => (
        <span key={l} className={`h-2.5 flex-1 rounded-sm ${l <= level ? "bg-brand-600" : "bg-slate-100"}`} aria-hidden />
      ))}
      {sejenjang > 0 && <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded bg-amber-500" style={{ left: `${(sejenjang / 5) * 100}%` }} aria-hidden />}
    </span>
  );
}

/** Potongan bagan: atasan → jabatan ini → bawahan langsung. */
function OrgSnippet({ j, bawahan }: { j: Jabatan; bawahan: { kode: string | null; nama: string | null; kelompok_jabatan: string | null; jumlah_kompetensi: number | null }[] }) {
  return (
    <div className="flex flex-col items-center px-4 py-5 text-center text-sm">
      {j.atasan_kode ? (
        <Link href={`/jabatan/${j.atasan_kode}`} className="max-w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-xs hover:border-brand-300 hover:text-brand-700">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Atasan langsung</span>
          {j.atasan_nama}
        </Link>
      ) : (
        <span className="text-xs text-slate-400">Tanpa atasan di bagan</span>
      )}
      <span className="h-4 w-px bg-slate-300" aria-hidden />
      <div className="max-w-full rounded-lg bg-brand-700 px-3 py-2 font-semibold text-white shadow-sm ring-4 ring-brand-100">{j.nama}</div>
      {bawahan.length > 0 && (
        <>
          <span className="h-4 w-px bg-slate-300" aria-hidden />
          <div className="w-full rounded-lg border border-dashed border-slate-300 p-2">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{bawahan.length} bawahan langsung</div>
            <ul className="flex flex-wrap justify-center gap-1.5">
              {bawahan.map((b) => (
                <li key={b.kode}>
                  <Link
                    href={`/jabatan/${b.kode}`}
                    className="inline-block rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"
                    title={`${b.kelompok_jabatan ?? ""}${b.jumlah_kompetensi ? ` · ${b.jumlah_kompetensi} kompetensi` : ""}`}
                  >
                    {b.nama}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

const METODE: Record<string, string> = { ai: "Analisis AI", tfidf: "Kemiripan teks", manual: "Ditambah HC", aturan: "Aturan jenjang" };

type Alasan = { jenis: "kepemimpinan" | "umum" | "terlewat" | "luar_bidang" | "celah"; saran: string[]; catatan: string | null };

const ALASAN: Record<Alasan["jenis"], { label: string; kelas: string; arti: string }> = {
  kepemimpinan: { label: "Kepemimpinan", kelas: "bg-slate-50 text-slate-500 ring-slate-200", arti: "Tugas manajerial — dicakup kompetensi kepemimpinan." },
  umum: { label: "Tugas umum", kelas: "bg-slate-50 text-slate-500 ring-slate-200", arti: "Tugas umum/administratif — dicakup kompetensi inti." },
  terlewat: { label: "Saran", kelas: "bg-white text-sky-700 ring-sky-300", arti: "Dicakup kompetensi teknis jabatan ini, tetapi belum dicantumkan sebagai bukti." },
  luar_bidang: { label: "Luar bidang", kelas: "bg-violet-50 text-violet-800 ring-violet-200", arti: "Butuh kompetensi di kamus yang belum dipetakan ke jabatan ini." },
  celah: { label: "Celah kamus", kelas: "bg-amber-50 text-amber-800 ring-amber-200", arti: "Tugas inti tanpa padanan kompetensi teknis di kamus — bahan review kamus." },
};

/** Label untuk butir tugas yang tidak menjadi bukti kompetensi teknis mana pun. */
function AlasanTanpaKode({ jenis, saran, catatan }: Alasan) {
  const a = ALASAN[jenis];
  return (
    <span title={[a.arti, catatan].filter(Boolean).join(" ")} className={`cursor-help rounded px-1.5 py-px text-[11px] font-medium ring-1 ring-inset ${a.kelas}`}>
      {a.label}
      {saran.length > 0 && ": "}
      {saran.map((k, i) => (
        <span key={k}>
          {i > 0 && ", "}
          <Link href={jenis === "terlewat" ? `#k-${k}` : `/kompetensi/${k}`} className="font-mono font-semibold hover:underline">
            {k}
          </Link>
        </span>
      ))}
    </span>
  );
}

/** Alasan + butir tugas pendukung untuk satu kompetensi teknis (bukti = nomor urut uraian tugas). */
function Bukti({ alasan, metode, bukti, tugas }: { alasan: string | null; metode: string | null; bukti: number[]; tugas: string[] }) {
  return (
    <div className="mt-1 text-xs text-slate-500">
      {metode && <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{METODE[metode] ?? metode}</span>}
      {metode === "ai" && alasan}
      {bukti.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-brand-700 hover:underline">Bukti: tugas {bukti.join(", ")}</summary>
          <ol className="mt-1 space-y-0.5 border-l-2 border-brand-100 pl-3 text-slate-600">
            {bukti.map((n) => (
              <li key={n}>
                <span className="mr-1 tabular-nums text-slate-400">{n}.</span>
                {tugas[n - 1] ?? "(butir tugas tidak ditemukan — jobdesk mungkin sudah diubah)"}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

const KATEGORI = (["inti", "kepemimpinan", "teknis"] as const).map((k) => [k, `Kompetensi ${KATEGORI_LABEL[k].toLowerCase()}`] as const);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-900">{children}</dd>
    </div>
  );
}

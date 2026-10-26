import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, ListEditor, PemetaanEditor, type KompetensiOption } from "@/components/editors";
import { DetailSkeleton } from "@/components/skeleton";
import { Card } from "@/components/ui";
import { hapusJabatan, simpanJobdesk, simpanPemetaan } from "@/lib/actions";
import { wajibEditor } from "@/lib/auth";
import { LEVEL_JENJANG } from "@/lib/labels";
import { must, supabase } from "@/lib/supabase";
import { FormJabatan } from "../../form-jabatan";
import { kodeRute } from "@/lib/url";

export const metadata: Metadata = { title: "Edit Jabatan" };

const KATEGORI_TUGAS = ["Perencanaan", "Pengorganisasian", "Pengarahan", "Pengawasan", "Kewenangan", "Tugas Kolektif", "Jabatan Ex Officio", "Kewajiban Pelaporan"];

export default function Page(props: PageProps<"/jabatan/[kode]/edit">) {
  return (
    <Suspense fallback={<DetailSkeleton label="Memuat formulir edit" />}>
      <Edit params={props.params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  await wajibEditor(`/jabatan/${kode}`);
  const j = await supabase
    .from("jabatan")
    .select("id, kode, nama, unit_kerja_id, atasan_id, jenjang, kelompok_jabatan, catatan, diubah_di_aplikasi")
    .eq("kode", kodeRute(kode))
    .maybeSingle()
    .then(must);
  if (!j) notFound();

  const [jobdesk, pemetaan, kompetensi] = await Promise.all([
    supabase
      .from("jobdesk")
      .select("id, diubah_di_aplikasi, atasan_langsung, membawahi, pendidikan, pendidikan_tambahan, pangkat, pengalaman_kerja, kompetensi, fungsi, file_sumber, tugas:jobdesk_tugas(urutan, kategori, deskripsi)")
      .eq("jabatan_id", j.id)
      .order("urutan")
      .limit(1)
      .maybeSingle()
      .then(must),
    supabase.from("jabatan_kompetensi").select("kompetensi_id, level_target, sumber, catatan, metode, bukti").eq("jabatan_id", j.id).then(must),
    supabase.from("v_kompetensi").select("id, kode, nama, bidang_nama, kategori, status, jumlah_level").order("urutan").then(must),
  ]);
  // kompetensi berstatus dihapus tidak ditawarkan, kecuali yang masih terpetakan ke jabatan ini (agar tetap tampil dan bisa dilepas)
  const terpetakan = new Set(pemetaan.map((p) => p.kompetensi_id));
  const options: KompetensiOption[] = kompetensi.filter((k) => k.status !== "dihapus" || terpetakan.has(k.id!)).map((k) => ({
    id: k.id!,
    kode: k.kode!,
    nama: k.nama!,
    bidang: k.bidang_nama!,
    kategori: k.kategori!,
    maxLevel: k.jumlah_level || 5,
  }));
  const tugas = [...(jobdesk?.tugas ?? [])].sort((a, b) => a.urutan - b.urutan);

  return (
    <article className="space-y-6">
      <Link href={`/jabatan/${j.kode}`} className="inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Kembali ke {j.nama}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-sm text-slate-500">{j.kode}</div>
          <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Edit: {j.nama}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tiap bagian disimpan terpisah.{" "}
            {j.diubah_di_aplikasi ? `Terakhir diubah di aplikasi ${new Date(j.diubah_di_aplikasi).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}.` : "Belum pernah diubah di aplikasi (masih hasil impor dokumen)."}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          {[
            ["#data", "Data jabatan"],
            ["#jobdesk", "Jobdesk"],
            ["#kompetensi", "Kompetensi"],
            ["#hapus", "Hapus"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="btn-secondary h-9 text-[13px]">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <Card title="Data jabatan" className="scroll-mt-6">
        <div id="data" className="scroll-mt-6 p-4">
          <FormJabatan nilai={j} submit="Simpan data jabatan" />
        </div>
      </Card>

      <Card title="Jobdesk" className="scroll-mt-6">
        <div id="jobdesk" className="scroll-mt-6 p-4">
          {jobdesk?.file_sumber && <p className="mb-4 text-xs text-slate-500">Sumber awal: {jobdesk.file_sumber}</p>}
          <ActionForm action={simpanJobdesk} submit="Simpan jobdesk">
            <input type="hidden" name="jabatan_id" value={j.id} />
            {/* versi saat halaman dibuka: simpan ditolak bila jobdesk sudah diubah di tab lain sejak itu */}
            <input type="hidden" name="versi" value={jobdesk?.diubah_di_aplikasi ?? ""} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="field-label">
                Atasan langsung (teks di dokumen)
                <input name="atasan_langsung" defaultValue={jobdesk?.atasan_langsung ?? ""} className="field" />
              </label>
              <label className="field-label">
                Pangkat / grade
                <input name="pangkat" defaultValue={jobdesk?.pangkat ?? ""} placeholder="mis. Grade 7" className="field" />
              </label>
              <label className="field-label">
                Pendidikan
                <input name="pendidikan" defaultValue={jobdesk?.pendidikan ?? ""} placeholder="mis. Minimal S1" className="field" />
              </label>
              <label className="field-label">
                Pendidikan tambahan
                <input name="pendidikan_tambahan" defaultValue={jobdesk?.pendidikan_tambahan ?? ""} className="field" />
              </label>
              <label className="field-label">
                Pengalaman kerja
                <textarea name="pengalaman_kerja" defaultValue={jobdesk?.pengalaman_kerja ?? ""} rows={2} className="field h-auto py-2" />
              </label>
              <label className="field-label">
                Kompetensi (syarat di dokumen)
                <textarea name="kompetensi" defaultValue={jobdesk?.kompetensi ?? ""} rows={2} className="field h-auto py-2" />
              </label>
            </div>
            <Fieldset legend="Membawahi">
              <ListEditor name="membawahi" initial={(jobdesk?.membawahi ?? []).map((t) => ({ teks: t }))} placeholder="Nama jabatan bawahan" addLabel="Tambah bawahan" />
            </Fieldset>
            <Fieldset legend="Fungsi / ikhtisar jabatan">
              <ListEditor name="fungsi" initial={(jobdesk?.fungsi ?? []).map((t) => ({ teks: t }))} placeholder="Fungsi jabatan" addLabel="Tambah fungsi" />
            </Fieldset>
            <Fieldset legend={`Uraian tugas (${tugas.length})`}>
              <ListEditor
                name="tugas"
                initial={tugas.map((t) => ({ kategori: t.kategori, teks: t.deskripsi, asal: t.urutan }))}
                kategori={KATEGORI_TUGAS}
                placeholder="Uraian tugas"
                addLabel="Tambah tugas"
              />
            </Fieldset>
          </ActionForm>
        </div>
      </Card>

      <Card title="Kompetensi yang dibutuhkan" className="scroll-mt-6">
        <div id="kompetensi" className="scroll-mt-6 p-4">
          {pemetaan.some((p) => p.sumber === "usulan") && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              Daftar ini masih <b>usulan otomatis</b>. Setelah disimpan, seluruh pemetaan jabatan ini ditandai sebagai hasil tinjauan (manual).
            </p>
          )}
          <ActionForm action={simpanPemetaan} submit="Simpan kompetensi">
            <input type="hidden" name="jabatan_id" value={j.id} />
            <PemetaanEditor
              name="pemetaan"
              options={options}
              initial={pemetaan.map((p) => ({ kompetensi_id: p.kompetensi_id, level_target: p.level_target }))}
              levelDefault={LEVEL_JENJANG[j.jenjang] ?? 2}
              dasar={Object.fromEntries(pemetaan.map((p) => [p.kompetensi_id, { alasan: p.catatan, metode: p.metode, bukti: p.bukti }]))}
              tugas={tugas.map((t) => t.deskripsi)}
            />
          </ActionForm>
        </div>
      </Card>

      <Card title="Hapus jabatan" className="scroll-mt-6 border-rose-200">
        <div id="hapus" className="scroll-mt-6 p-4">
          <p className="mb-4 text-sm text-slate-600">
            Menghapus jabatan juga menghapus pemetaan kompetensinya. Jobdesk tetap tersimpan tanpa tautan, dan bawahan langsung kehilangan atasannya. Tindakan ini tidak bisa
            dibatalkan dari aplikasi.
          </p>
          <ActionForm action={hapusJabatan} submit="Hapus jabatan" danger>
            <input type="hidden" name="id" value={j.id} />
            <label className="field-label max-w-xs">
              Ketik HAPUS untuk konfirmasi
              <input name="konfirmasi" autoComplete="off" className="field" />
            </label>
          </ActionForm>
        </div>
      </Card>
    </article>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{legend}</legend>
      {children}
    </fieldset>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, ListEditor } from "@/components/editors";
import { DetailSkeleton } from "@/components/skeleton";
import { Card } from "@/components/ui";
import { hapusKompetensi, hapusKompetensiPermanen, simpanKompetensi } from "@/lib/actions";
import { wajibEditor } from "@/lib/auth";
import { LEVEL_NAMA, STATUS_LABEL } from "@/lib/labels";
import { must, supabase } from "@/lib/supabase";
import { LevelEditor } from "./level-editor";
import { kodeRute } from "@/lib/url";

export const metadata: Metadata = { title: "Edit Kompetensi" };

export default function Page(props: PageProps<"/kompetensi/[kode]/edit">) {
  return (
    <Suspense fallback={<DetailSkeleton label="Memuat formulir edit" />}>
      <Edit params={props.params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  await wajibEditor(`/kompetensi/${kode}`);
  const k = await supabase
    .from("kompetensi")
    .select(
      "id, kode, nama, definisi, status, catatan, diubah_di_aplikasi, pemetaan:jabatan_kompetensi(count), bidang:bidang_kompetensi!kompetensi_bidang_id_fkey(nama), level:kompetensi_level(level, deskripsi, indikator:indikator_perilaku(urutan, deskripsi))",
    )
    .eq("kode", kodeRute(kode))
    .maybeSingle()
    .then(must);
  if (!k) notFound();
  const jumlahJabatan = k.pemetaan[0]?.count ?? 0;

  const levels = [1, 2, 3, 4, 5].map((lv) => {
    const l = k.level.find((x) => x.level === lv);
    return {
      level: lv,
      deskripsi: l?.deskripsi ?? "",
      indikator: [...(l?.indikator ?? [])].sort((a, b) => a.urutan - b.urutan).map((i) => ({ teks: i.deskripsi })),
    };
  });

  return (
    <article className="space-y-6">
      <Link href={`/kompetensi/${k.kode}`} className="inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Kembali ke {k.kode}
      </Link>
      <header>
        <div className="font-mono text-sm text-slate-500">
          {k.kode} · {k.bidang?.nama}
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Edit: {k.nama}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {k.diubah_di_aplikasi ? `Terakhir diubah di aplikasi ${new Date(k.diubah_di_aplikasi).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}.` : "Belum pernah diubah di aplikasi (masih hasil impor dokumen)."}
        </p>
      </header>

      <ActionForm action={simpanKompetensi} submit="Simpan kompetensi">
        <input type="hidden" name="id" value={k.id} />
        <Card title="Identitas">
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_200px]">
            <label className="field-label">
              Nama kompetensi
              <input name="nama" required defaultValue={k.nama} className="field" />
            </label>
            <label className="field-label">
              Status
              <select name="status" defaultValue={k.status} className="field">
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label md:col-span-2">
              Definisi
              <textarea name="definisi" defaultValue={k.definisi ?? ""} rows={3} className="field h-auto py-2 leading-relaxed" />
            </label>
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Catatan review</div>
              <ListEditor name="catatan" initial={k.catatan.map((c) => ({ teks: c }))} placeholder="Catatan" addLabel="Tambah catatan" />
            </div>
          </div>
        </Card>
        <Card title="Level & indikator perilaku">
          <LevelEditor levels={levels} namaLevel={[...LEVEL_NAMA]} />
        </Card>
      </ActionForm>

      {k.status !== "dihapus" ? (
        <Card title="Hapus kompetensi" className="border-rose-200">
          <div className="p-4">
            <p className="mb-4 text-sm text-slate-600">
              Kompetensi ditandai berstatus Dihapus dan {jumlahJabatan > 0 ? <b>dilepas dari {jumlahJabatan} jabatan</b> : "tidak dipetakan ke jabatan mana pun"}. Level, indikator, dan
              penilaian diri tetap tersimpan; kompetensi bisa dipulihkan dengan mengubah statusnya kembali, tetapi pemetaan jabatan harus dibuat ulang.
            </p>
            <ActionForm action={hapusKompetensi} submit="Hapus kompetensi" danger>
              <input type="hidden" name="id" value={k.id} />
              <label className="field-label max-w-xs">
                Ketik HAPUS untuk konfirmasi
                <input name="konfirmasi" autoComplete="off" className="field" />
              </label>
            </ActionForm>
          </div>
        </Card>
      ) : (
        <Card title="Hapus permanen" className="border-rose-200">
          <div className="p-4">
            {jumlahJabatan > 0 ? (
              <p className="text-sm text-slate-600">
                Kompetensi ini masih dipetakan ke {jumlahJabatan} jabatan.{" "}
                <Link href={`/kompetensi/${k.kode}/pemetaan`} className="font-medium text-slate-900 underline">
                  Lepas pemetaannya
                </Link>{" "}
                dulu sebelum menghapus permanen.
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-slate-600">
                  Menghapus permanen kompetensi beserta seluruh level, indikator perilaku, dan penilaian diri pengguna. Tindakan ini tidak bisa dibatalkan dari aplikasi.
                </p>
                <ActionForm action={hapusKompetensiPermanen} submit="Hapus permanen" danger>
                  <input type="hidden" name="id" value={k.id} />
                  <label className="field-label max-w-xs">
                    Ketik {k.kode} untuk konfirmasi
                    <input name="konfirmasi" autoComplete="off" className="field" />
                  </label>
                </ActionForm>
              </>
            )}
          </div>
        </Card>
      )}
    </article>
  );
}

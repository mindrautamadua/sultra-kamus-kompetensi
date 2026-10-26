import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, PemetaanJabatanEditor, type JabatanOption } from "@/components/editors";
import { DetailSkeleton } from "@/components/skeleton";
import { Card } from "@/components/ui";
import { simpanPemetaanKompetensi } from "@/lib/actions";
import { wajibEditor } from "@/lib/auth";
import { LEVEL_JENJANG } from "@/lib/labels";
import { must, supabase } from "@/lib/supabase";
import { kodeRute } from "@/lib/url";

export const metadata: Metadata = { title: "Petakan ke Jabatan" };

export default function Page(props: PageProps<"/kompetensi/[kode]/pemetaan">) {
  return (
    <Suspense fallback={<DetailSkeleton label="Memuat formulir pemetaan" />}>
      <Pemetaan params={props.params} />
    </Suspense>
  );
}

async function Pemetaan({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  await wajibEditor(`/kompetensi/${kode}`);
  const k = await supabase.from("v_kompetensi").select("id, kode, nama, bidang_nama, status, jumlah_level").eq("kode", kodeRute(kode)).maybeSingle().then(must);
  if (!k?.id) notFound();

  const [pemetaan, jabatan] = await Promise.all([
    supabase.from("jabatan_kompetensi").select("jabatan_id, level_target").eq("kompetensi_id", k.id).then(must),
    supabase.from("v_jabatan").select("id, kode, nama, unit_nama, jenjang").order("urutan").then(must),
  ]);
  const options: JabatanOption[] = jabatan.flatMap((j) =>
    j.id && j.kode && j.nama ? [{ id: j.id, kode: j.kode, nama: j.nama, unit: j.unit_nama ?? "", levelDefault: LEVEL_JENJANG[j.jenjang ?? 4] ?? 2 }] : [],
  );

  return (
    <article className="space-y-6">
      <Link href={`/kompetensi/${k.kode}#jabatan`} className="inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Kembali ke {k.kode}
      </Link>
      <header>
        <div className="font-mono text-sm text-slate-500">
          {k.kode} · {k.bidang_nama}
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">Petakan ke jabatan: {k.nama}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Tambah, ubah level target, atau lepas jabatan yang membutuhkan kompetensi ini. Hanya pemetaan kompetensi {k.kode} yang berubah; kompetensi lain di jabatan
          tersebut tidak tersentuh. Jabatan yang berubah kembali ke status <b>draf</b> dan perlu ditandai selesai ulang.
        </p>
      </header>

      {k.status === "dihapus" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          Kompetensi ini berstatus <b>dihapus</b>. Sebaiknya hanya lepas pemetaan yang tersisa, jangan menambah jabatan baru.
        </p>
      )}

      <Card title="Jabatan yang membutuhkan">
        <div className="p-4">
          <ActionForm action={simpanPemetaanKompetensi} submit="Simpan pemetaan">
            <input type="hidden" name="kompetensi_id" value={k.id} />
            <PemetaanJabatanEditor name="pemetaan" options={options} initial={pemetaan} maxLevel={k.jumlah_level || 5} />
          </ActionForm>
        </div>
      </Card>
    </article>
  );
}

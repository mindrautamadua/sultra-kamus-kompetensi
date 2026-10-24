import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DetailSkeleton } from "@/components/skeleton";
import { Card, PageHeader } from "@/components/ui";
import { wajibEditor } from "@/lib/auth";
import { must, supabase } from "@/lib/supabase";
import { FormJabatan } from "../form-jabatan";

export const metadata: Metadata = { title: "Tambah Jabatan" };

type Search = { nama?: string; unit?: string };

export default function Page(props: PageProps<"/jabatan/baru">) {
  return (
    <>
      <Link href="/jabatan" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← Daftar Jabatan
      </Link>
      <PageHeader title="Tambah Jabatan" desc="Jabatan baru langsung tersimpan di database. Setelah disimpan, lengkapi jobdesk dan kompetensinya dari halaman edit." />
      <Suspense fallback={<DetailSkeleton label="Memuat formulir" />}>
        <Isi searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function Isi({ searchParams }: { searchParams: Promise<Search> }) {
  await wajibEditor("/jabatan");
  const { nama = "", unit = "" } = await searchParams;
  // prefill dari "Ada di bagan, belum ada jobdesk" (unit = nama unit kerja)
  const u = unit ? (await supabase.from("unit_kerja").select("id").eq("nama", unit).maybeSingle().then(must)) : null;
  const rapi = nama ? nama.toLowerCase().replace(/(^|[\s(/&-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : "";
  return (
    <Card title="Data jabatan">
      <div className="p-4">
        <FormJabatan nilai={{ nama: rapi, unit_kerja_id: u?.id ?? null }} submit="Tambah jabatan" />
      </div>
    </Card>
  );
}

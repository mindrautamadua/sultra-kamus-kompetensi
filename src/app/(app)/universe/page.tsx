import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { Bone } from "@/components/skeleton";
import { loadUniverse } from "@/lib/universe";
import { Peta } from "./peta";

export const metadata: Metadata = { title: "Universe Kompetensi" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Universe Kompetensi"
        desc="Jelajahi kamus dan struktur organisasi sebagai jaringan. Klik node untuk membuka cabangnya; klik kompetensi atau jabatan untuk melihat pasangan pemetaannya beserta level target."
      />
      <Suspense fallback={<Bone className="h-[calc(100dvh-220px)] min-h-[520px] w-full rounded-xl" />}>
        <Isi />
      </Suspense>
    </>
  );
}

async function Isi() {
  return <Peta data={await loadUniverse()} />;
}

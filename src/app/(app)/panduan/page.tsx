import type { Metadata } from "next";
import { Suspense } from "react";
import { penggunaSaatIni } from "@/lib/auth";
import { Panduan } from "./panduan";

export const metadata: Metadata = { title: "Panduan Pengguna" };

// Isi panduan statis; peran pengguna dibaca dari cookie lalu di-stream untuk menyorot kartu peran
// dan menandai bagian yang tidak tersedia.
export default function Page() {
  return (
    <Suspense fallback={<Panduan peran={null} />}>
      <DenganPeran />
    </Suspense>
  );
}

async function DenganPeran() {
  const s = await penggunaSaatIni();
  return <Panduan peran={s?.peran ?? null} />;
}

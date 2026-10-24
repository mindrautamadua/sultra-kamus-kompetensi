import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LEVEL_NAMA } from "@/lib/labels";
import { bacaPengaturan } from "@/lib/pengaturan";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Masuk" };

// Urutan masuk: brand, judul, form, lalu tangga level tumbuh L1 ke L5 (menceritakan jenjang kompetensi).
const MUNCUL = "animate-[masuk_600ms_cubic-bezier(0.16,1,0.3,1)_both]";

export default function Page(props: PageProps<"/login">) {
  return (
    <div className="grid min-h-[100dvh] grid-cols-1 bg-slate-50 lg:grid-cols-[1.15fr_1fr]">
      <BrandPanel />
      <main className="flex items-center justify-center px-4 py-12 sm:px-8 lg:py-16">
        <div className={`w-full max-w-sm ${MUNCUL}`} style={{ animationDelay: "120ms" }}>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Masuk</h2>
          <p className="mt-1.5 text-[15px] text-slate-600">Gunakan akun dari Divisi Human Capital.</p>
          {/* searchParams adalah data per permintaan, jadi form di-stream di balik Suspense */}
          <Suspense fallback={<FormSkeleton />}>
            <Form searchParams={props.searchParams} />
          </Suspense>
          <p className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-500">
            Lupa password atau akun terkunci? Minta reset ke admin HC.
          </p>
        </div>
      </main>
    </div>
  );
}

function BrandPanel() {
  return (
    <section className="relative isolate flex flex-col overflow-hidden bg-brand-950 px-6 py-8 text-brand-100 sm:px-10 lg:px-14 lg:py-12">
      {/* cahaya lembut di sudut, bukan gradien ungu: hanya turunan navy brand */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 -z-10 size-[520px] rounded-full bg-brand-700/35 blur-3xl"
      />
      <div className={`flex items-center gap-4 ${MUNCUL}`}>
        <Image src="/brand/logo-bank-sultra-putih.png" alt="Bank Sultra" width={399} height={101} priority className="h-10 w-auto" />
        <span className="border-l border-white/15 pl-4 font-heading text-sm font-medium text-brand-200">Kamus Kompetensi</span>
      </div>

      <div className="mt-10 max-w-2xl lg:mt-auto">
        <h1
          className={`font-heading text-3xl leading-[1.15] font-semibold tracking-tight text-white sm:text-4xl xl:text-[2.75rem] ${MUNCUL}`}
          style={{ animationDelay: "90ms" }}
        >
          Kompetensi dan jabatan, dalam satu tempat.
        </h1>
        <p className={`mt-4 max-w-[46ch] text-base leading-relaxed text-brand-200 lg:text-lg ${MUNCUL}`} style={{ animationDelay: "180ms" }}>
          Kamus kompetensi, uraian tugas, dan pemetaan level untuk seluruh jabatan struktur 2026.
        </p>
      </div>

      <LevelLadder />

      <p className={`mt-10 hidden text-sm text-brand-300 lg:block ${MUNCUL}`} style={{ animationDelay: "750ms" }}>
        Struktur Organisasi Perubahan Ketiga, 10 Juli 2026
      </p>
    </section>
  );
}

/** Lima level kompetensi (Dasar s.d. Master) sebagai tangga: konsep inti kamus, bukan hiasan. */
function LevelLadder() {
  return (
    <ol className="mt-12 hidden max-w-md grid-cols-5 items-end gap-1.5 lg:mt-14 lg:mb-auto lg:grid" aria-label="Lima level kompetensi">
      {LEVEL_NAMA.map((nama, i) => (
        <li key={nama} className="flex flex-col gap-2">
          <span
            className="block origin-bottom animate-[naik_700ms_cubic-bezier(0.16,1,0.3,1)_both] rounded-sm bg-amber-400"
            style={{ height: 12 + i * 14, opacity: 0.3 + i * 0.175, animationDelay: `${300 + i * 90}ms` }}
          />
          <span className={`text-xs text-brand-300 ${MUNCUL}`} style={{ animationDelay: `${420 + i * 90}ms` }}>
            <span className="font-mono text-amber-300">L{i + 1}</span> {nama}
          </span>
        </li>
      ))}
    </ol>
  );
}

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ dari }, atur] = await Promise.all([searchParams, bacaPengaturan()]);
  return <FormLogin dari={typeof dari === "string" ? dari : "/"} lamaIngatHari={atur.lama_ingat_hari} />;
}

function FormSkeleton() {
  return (
    <div className="mt-8 space-y-5" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-20 rounded bg-slate-200" />
          <div className="h-11 rounded-lg bg-slate-200/70" />
        </div>
      ))}
      <div className="h-11 rounded-lg bg-slate-300/70" />
    </div>
  );
}

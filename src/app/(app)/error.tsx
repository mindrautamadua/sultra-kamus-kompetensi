"use client";

import Link from "next/link";
import { useEffect } from "react";

// Batas galat untuk semua halaman di dalam sidebar: galat tak terduga tampil di sini, sidebar tetap bisa dipakai.
export default function Galat({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <div role="alert" className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-rose-50/60 p-6 text-rose-900">
      <h1 className="text-lg font-semibold">Halaman gagal dimuat</h1>
      <p className="mt-2 text-sm leading-relaxed">
        Terjadi galat saat memuat halaman ini. Coba muat ulang; bila tetap gagal, sesi login mungkin sudah berakhir atau koneksi ke
        database terputus.
      </p>
      {digest && <p className="mt-2 font-mono text-xs text-rose-700">Kode galat: {digest}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => retry()} className="btn-primary">
          Coba lagi
        </button>
        <Link href="/login" className="btn-secondary">
          Login ulang
        </Link>
      </div>
    </div>
  );
}

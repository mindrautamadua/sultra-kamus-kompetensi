"use client";

import { useEffect, useState } from "react";

/** Angka yang menghitung naik dari 0 saat tampil. Nilai sebenarnya selalu tersedia untuk pembaca layar;
 *  bila prefers-reduced-motion aktif, angka langsung tampil tanpa animasi. */
export function Hitung({ n, akhiran = "", durasi = 900 }: { n: number; akhiran?: string; durasi?: number }) {
  const [v, setV] = useState(0);

  useEffect(() => {
    // reduced motion: durasi 0, frame pertama langsung menampilkan nilai akhir
    const d = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : durasi;
    let raf = 0;
    const mulai = performance.now();
    const langkah = (t: number) => {
      const p = d ? Math.min(1, (t - mulai) / d) : 1;
      setV(Math.round(n * (1 - (1 - p) ** 3))); // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(langkah);
    };
    raf = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(raf);
  }, [n, durasi]);

  const teks = `${n.toLocaleString("id-ID")}${akhiran}`;
  return (
    <>
      <span aria-hidden>
        {v.toLocaleString("id-ID")}
        {akhiran}
      </span>
      <span className="sr-only">{teks}</span>
    </>
  );
}

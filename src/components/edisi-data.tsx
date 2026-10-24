import { bacaPengaturan } from "@/lib/pengaturan";

const KOTAK = "rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-brand-200 ring-1 ring-white/10 md:collapsed:hidden";

/** Kotak edisi data di sidebar; teksnya diatur admin di Admin › Pengaturan. */
export async function EdisiData() {
  const p = await bacaPengaturan();
  return (
    <div className={KOTAK}>
      <div className="font-semibold text-white">{p.edisi_judul}</div>
      {p.edisi_keterangan}
    </div>
  );
}

export function EdisiDataKosong() {
  return <div className={`${KOTAK} h-[60px]`} aria-hidden />;
}

import Link from "next/link";
import { Card } from "@/components/ui";
import { kesenjangan, loadProfil, saranJalur } from "@/lib/kedekatan";

/** Ringkasan jalur karier di detail jabatan: kesenjangan ke atasan langsung + jabatan sejenjang paling mirip. */
export async function JalurCard({ jabatanId, kode }: { jabatanId: number; kode: string }) {
  const semua = await loadProfil();
  const asal = semua.get(jabatanId);
  if (!asal || asal.kompetensi.size === 0) return null;
  const { atasan, rotasi } = saranJalur(asal, semua, 3);
  const keAtasan = atasan && atasan.kompetensi.size ? kesenjangan(asal, atasan) : null;

  return (
    <Card
      title="Jalur karier"
      action={
        <Link href={`/karier?asal=${encodeURIComponent(kode)}`} className="link text-xs">
          Semua saran →
        </Link>
      }
    >
      <div className="grid divide-y divide-slate-100 text-sm md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Promosi ke atasan langsung</h3>
          {keAtasan && atasan ? (
            <Link href={`/karier?${new URLSearchParams({ asal: kode, tujuan: atasan.kode })}`} className="group block">
              <span className="font-medium text-slate-900 group-hover:text-brand-700">{atasan.nama}</span>
              <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                <Chip>{keAtasan.baru.length} kompetensi baru</Chip>
                <Chip>{keAtasan.naik.length} naik level</Chip>
                <Chip>{keAtasan.langkah} langkah level</Chip>
              </span>
            </Link>
          ) : (
            <p className="text-slate-500">Tidak ada atasan dengan pemetaan kompetensi.</p>
          )}
        </div>
        <div className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Paling mirip — sejenjang, unit lain</h3>
          {rotasi.length ? (
            <ul className="space-y-1.5">
              {rotasi.map((s) => (
                <li key={s.p.id} className="flex items-baseline gap-2">
                  <Link
                    href={`/karier?${new URLSearchParams({ asal: kode, tujuan: s.p.kode })}`}
                    className="min-w-0 flex-1 truncate hover:text-brand-700"
                    title={`${s.p.nama} — ${s.p.unitInduk}`}
                  >
                    {s.p.nama} <span className="text-xs text-slate-500">· {s.p.unitInduk}</span>
                  </Link>
                  <span className="shrink-0 text-xs tabular-nums text-slate-600">{Math.round(s.kemiripan * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">Belum ada jabatan sejenjang yang sebanding.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">{children}</span>;
}

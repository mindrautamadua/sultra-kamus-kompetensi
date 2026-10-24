import Link from "next/link";
import { logout } from "@/lib/auth-actions";
import { penggunaSaatIni } from "@/lib/auth";
import { bolehKelolaAkun, PERAN_LABEL } from "@/lib/peran";

const TAUTAN = "rounded-md px-2 py-1 text-xs font-medium text-brand-200 hover:bg-white/10 hover:text-white";

export async function AkunSaya() {
  const s = await penggunaSaatIni();
  if (!s) return null;
  return (
    <div className="space-y-2">
      <div className="flex gap-1 px-1 md:collapsed:hidden">
        <Link href="/akun" className={TAUTAN}>
          Akun saya
        </Link>
        {bolehKelolaAkun(s.peran) && (
          <Link href="/admin/pengguna" className={TAUTAN}>
            Admin
          </Link>
        )}
      </div>
      <form action={logout} className="flex items-center gap-2 px-2 md:collapsed:flex-col md:collapsed:px-0">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold uppercase text-white"
          title={`${s.nama} (${s.username}) · ${PERAN_LABEL[s.peran]}`}
          aria-hidden
        >
          {s.nama.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1 text-xs leading-tight md:collapsed:hidden">
          <div className="truncate font-semibold text-white">{s.nama}</div>
          <div className="truncate text-brand-300">
            {s.username} · {PERAN_LABEL[s.peran]}
          </div>
        </div>
        <button
          type="submit"
          title="Keluar"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-brand-200 hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-4" aria-hidden>
            <path d="M8 3.5H4.5v13H8M12.5 6.5 16 10l-3.5 3.5M16 10H8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="sr-only">Keluar</span>
        </button>
      </form>
    </div>
  );
}

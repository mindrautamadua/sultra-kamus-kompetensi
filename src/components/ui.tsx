import Link from "next/link";
import { REVIEW_LABEL, REVIEW_STYLE, STATUS_LABEL, STATUS_STYLE } from "@/lib/labels";

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">{title}</h1>
        {desc && <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-slate-600">{desc}</p>}
      </div>
      {children}
    </header>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "lengkap";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLE[s]}`}>
      {STATUS_LABEL[s] ?? s}
    </span>
  );
}

export function ReviewBadge({ status }: { status: string | null }) {
  const s = status ?? "draf";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${REVIEW_STYLE[s]}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {REVIEW_LABEL[s] ?? s}
    </span>
  );
}

export function Tag({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      {children}
    </span>
  );
}

// warna garis atas & ikon kartu Stat; "amber" menandai masih ada pekerjaan tertunda
const STAT_AKSEN = {
  brand: { garis: "before:from-brand-700 before:to-brand-400", ikon: "bg-brand-50 text-brand-700 ring-brand-100" },
  amber: { garis: "before:from-amber-500 before:to-amber-300", ikon: "bg-amber-50 text-amber-700 ring-amber-100" },
  emerald: { garis: "before:from-emerald-600 before:to-emerald-400", ikon: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
} as const;

export function Stat({
  label,
  value,
  hint,
  href,
  icon,
  aksen = "brand",
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  icon?: string;
  aksen?: keyof typeof STAT_AKSEN;
  /** konten tambahan di bawah angka, mis. batang mini */
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        {icon && (
          <span className={`grid size-9 shrink-0 place-items-center rounded-lg ring-1 ${STAT_AKSEN[aksen].ikon}`}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-5" aria-hidden>
              <path d={icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      <div className="mt-1 font-heading text-3xl font-semibold tabular-nums text-slate-900">{value}</div>
      {children}
      {hint && <div className="mt-1 text-[13px] text-slate-600">{hint}</div>}
    </>
  );
  const cls = `relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r ${STAT_AKSEN[aksen].garis}`;
  return href ? (
    <Link href={href} className={`${cls} transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Batang bertumpuk tipis: tiap bagian proporsional terhadap jumlah semua bagian. */
export function Batang({ bagian, className = "" }: { bagian: { n: number; kelas: string; label: string }[]; className?: string }) {
  const jumlah = bagian.reduce((s, b) => s + b.n, 0);
  if (!jumlah) return null;
  return (
    // span (bukan div) karena juga dipakai di dalam tautan
    <span
      className={`flex h-1.5 origin-left animate-[tumbuh_0.8s_ease-out_both] gap-px overflow-hidden rounded-full bg-slate-100 ${className}`}
      role="img"
      aria-label={bagian.map((b) => `${b.n} ${b.label}`).join(", ")}
    >
      {bagian.map((b) => b.n > 0 && <span key={b.label} className={`block ${b.kelas}`} style={{ width: `${(b.n / jumlah) * 100}%` }} title={`${b.n} ${b.label}`} />)}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">{children}</div>;
}

/** Tautan ke dokumen PDF (route handler /dokumen/...), dibuka di tab baru pada penampil PDF browser. */
export function PdfLink({ href, children, className = "btn-secondary h-9 shrink-0 text-[13px]" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={className}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-4" aria-hidden>
        <path d="M5 2.5h7l3.5 3.5v11.5H5z M12 2.5V6h3.5 M7.5 10.5h5 M7.5 13.5h5" strokeLinejoin="round" />
      </svg>
      {children}
    </a>
  );
}

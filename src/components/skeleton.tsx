// Loading placeholders shaped like the real content (Suspense fallbacks). The shimmer comes from the
// `.bone` class in globals.css and stops under prefers-reduced-motion.

export function Bone({ className = "" }: { className?: string }) {
  return <div className={`bone rounded-md ${className}`} />;
}

function Wrap({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// deterministic widths so rows look natural without hydration differences
const W = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-3/5", "w-2/5", "w-4/5"];
const w = (i: number) => W[i % W.length];

function CardShell({ rows, className = "", children }: { rows?: number; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3.5">
        <Bone className="h-3 w-40" />
      </div>
      {children ??
        Array.from({ length: rows ?? 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-0">
            <Bone className={`h-3.5 ${w(i)}`} />
            <Bone className="ml-auto h-3.5 w-10" />
          </div>
        ))}
    </div>
  );
}

export function FilterBarSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="filter-bar">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className={`flex flex-col gap-2 ${i === 0 ? "min-w-56 flex-1" : "w-44"}`}>
          <Bone className="h-2.5 w-20" />
          <Bone className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Bone className="h-10 w-28 rounded-lg" />
    </div>
  );
}

export function DashboardSkeleton({ label = "Memuat ringkasan" }: { label?: string }) {
  return (
    <Wrap label={label} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex h-60 items-center gap-6 rounded-2xl bg-brand-950 p-6 xl:col-span-2">
          <div className="size-36 shrink-0 rounded-full border-[10px] border-white/10" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-40 rounded-md bg-white/10" />
            <div className="h-6 w-3/4 rounded-md bg-white/10" />
            <div className="h-1.5 w-full rounded-full bg-white/10" />
            <div className="h-1.5 w-full rounded-full bg-white/10" />
          </div>
        </div>
        <CardShell rows={5} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex justify-between">
              <Bone className="h-3 w-24" />
              <Bone className="size-9 rounded-lg" />
            </div>
            <Bone className="mt-3 h-8 w-20" />
            <Bone className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <CardShell className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex justify-between">
                  <Bone className="h-4 w-12" />
                  <Bone className="size-8 rounded-full" />
                </div>
                <Bone className={`mt-2 h-4 ${w(i)}`} />
                <Bone className="mt-3 h-1.5 w-full rounded-full" />
                <Bone className="mt-2 h-3 w-32" />
              </div>
            ))}
          </div>
        </CardShell>
        <div className="space-y-6">
          <CardShell rows={6} />
          <CardShell>
            <div className="flex h-40 items-end gap-3 px-4 pb-4 pt-6">
              {[55, 70, 85, 88, 65].map((h, i) => (
                <div key={i} className="bone flex-1 rounded-t-md" style={{ height: `${h}%` }} />
              ))}
            </div>
          </CardShell>
        </div>
      </div>
    </Wrap>
  );
}

/** Daftar Jabatan: filter, panel struktur (navy), kartu statistik, lalu kartu unit. */
export function JabatanSkeleton() {
  return (
    <Wrap label="Memuat daftar jabatan" className="space-y-6">
      <FilterBarSkeleton fields={4} />
      <div className="grid grid-cols-1 h-64 gap-8 rounded-2xl bg-brand-950 p-6 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-3">
          <div className="h-3 w-40 rounded-md bg-white/10" />
          <div className="mb-5 h-6 w-3/4 rounded-md bg-white/10" />
          {[8, 20, 30, 45, 100].map((p, i) => (
            <div key={i} className="mx-auto h-6 rounded-md bg-white/10" style={{ width: `${p * 0.6}%` }} />
          ))}
        </div>
        <div className="hidden gap-3 lg:col-span-2 lg:grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/[0.06]" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Bone className="h-3 w-24" />
            <Bone className="mt-3 h-8 w-20" />
            <Bone className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CardShell rows={6} />
        <CardShell rows={6} />
      </div>
    </Wrap>
  );
}

/** Filter bar + grouped list cards (Kamus Kompetensi, Daftar Jabatan). */
export function ListSkeleton({ label, fields = 3, groups = 2, rows = 6, columns = 1 }: { label: string; fields?: number; groups?: number; rows?: number; columns?: 1 | 2 }) {
  return (
    <Wrap label={label} className="space-y-6">
      <FilterBarSkeleton fields={fields} />
      <Bone className="h-3 w-32" />
      <div className={`grid gap-6 ${columns === 2 ? "xl:grid-cols-2" : ""}`}>
        {Array.from({ length: groups }).map((_, g) => (
          <CardShell key={g}>
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex gap-6 border-b border-slate-100 px-4 py-3.5 last:border-0">
                <Bone className="h-3.5 w-14 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Bone className={`h-3.5 ${w(i + g)}`} />
                  {columns === 1 && <Bone className={`h-3 ${w(i + g + 3)}`} />}
                </div>
                <Bone className="h-3 w-16 shrink-0" />
              </div>
            ))}
          </CardShell>
        ))}
      </div>
    </Wrap>
  );
}

export function MatriksSkeleton() {
  const cols = 22;
  return (
    <Wrap label="Memuat matriks kompetensi" className="space-y-4">
      <FilterBarSkeleton fields={3} />
      <div className="flex justify-between">
        <Bone className="h-3 w-28" />
        <Bone className="h-3 w-56" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Bone className="h-3 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-5 w-16" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex border-b border-slate-200">
          <div className="w-64 shrink-0 border-r border-slate-200 p-3">
            <Bone className="mt-24 h-3 w-16" />
          </div>
          <div className="flex flex-1 gap-0">
            {Array.from({ length: cols }).map((_, i) => (
              <div key={i} className="flex h-40 flex-1 items-end justify-center border-l border-slate-100 pb-3">
                <Bone className={`w-2.5 ${["h-24", "h-32", "h-20", "h-28"][i % 4]}`} />
              </div>
            ))}
          </div>
        </div>
        {Array.from({ length: 12 }).map((_, r) => (
          <div key={r} className="flex border-b border-slate-100 last:border-0">
            <div className="w-64 shrink-0 border-r border-slate-100 px-3 py-2.5" style={{ paddingLeft: `${0.75 + (r % 4) * 0.75}rem` }}>
              <Bone className={`h-3 ${w(r)}`} />
            </div>
            <div className="flex flex-1">
              {Array.from({ length: cols }).map((_, c) => (
                <div key={c} className="flex-1 border-l border-slate-100 p-1">
                  {/* filled cells roughly follow the real pattern: core columns always, technical sparse */}
                  {(c < 5 || (c < 9 && r % 4 < 3) || (c * 7 + r * 3) % 5 === 0) && <Bone className="h-5 w-full rounded-sm" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

export function AnalisaSkeleton() {
  return (
    <Wrap label="Memuat analisa data" className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CardShell rows={5} />
        <CardShell rows={5} />
      </div>
      <CardShell rows={4} />
      <CardShell rows={6} />
    </Wrap>
  );
}

/** Detail jabatan: panel judul (navy), kartu statistik, struktur + jobdesk. */
export function JabatanDetailSkeleton() {
  return (
    <Wrap label="Memuat detail jabatan" className="space-y-6">
      <div className="space-y-3 rounded-2xl bg-brand-950 p-6">
        <div className="flex gap-2">
          <div className="h-5 w-24 rounded-md bg-white/10" />
          <div className="h-5 w-28 rounded-full bg-white/10" />
        </div>
        <div className="h-8 w-96 max-w-full rounded-md bg-white/10" />
        <div className="h-4 w-72 max-w-full rounded-md bg-white/10" />
        <div className="flex gap-2 pt-3">
          <div className="h-9 w-40 rounded-lg bg-white/10" />
          <div className="h-9 w-56 rounded-lg bg-white/10" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Bone className="h-3 w-24" />
            <Bone className="mt-3 h-8 w-16" />
            <Bone className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CardShell rows={4} />
        <CardShell className="lg:col-span-2">
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Bone key={i} className={`h-3.5 ${w(i)}`} />
            ))}
          </div>
        </CardShell>
      </div>
    </Wrap>
  );
}

/** Detail page: header (code, tags, title) + info cards + long text card. */
export function DetailSkeleton({ label }: { label: string }) {
  return (
    <Wrap label={label} className="space-y-6">
      <div className="space-y-3 border-b border-slate-200 pb-5">
        <div className="flex gap-2">
          <Bone className="h-4 w-20" />
          <Bone className="h-4 w-24 rounded-full" />
          <Bone className="h-4 w-32 rounded-full" />
        </div>
        <Bone className="h-7 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CardShell rows={4} />
        <CardShell rows={3} className="lg:col-span-2" />
      </div>
      <CardShell>
        <div className="space-y-3 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Bone key={i} className={`h-3.5 ${w(i)}`} />
          ))}
        </div>
      </CardShell>
    </Wrap>
  );
}

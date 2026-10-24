"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import type { FormState } from "@/lib/actions";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

/** Form bound to a Server Action: shows the error it returns and a pending state on the submit button. */
export function ActionForm({
  action,
  submit = "Simpan",
  danger = false,
  className = "",
  children,
}: {
  action: Action;
  submit?: string;
  danger?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    // Submitted via onSubmit instead of action={...}: a form action makes React reset every uncontrolled field
    // once it finishes, which would wipe what the user typed whenever the server returns a validation error.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className={`space-y-4 ${className}`}
    >
      {children}
      {state?.error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
          {state.error}
        </p>
      )}
      {state?.pesan && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {state.pesan}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className={`${danger ? "btn bg-rose-600 text-white hover:bg-rose-700" : "btn-primary"} min-w-32 disabled:opacity-70`}
        >
          {pending && <Spinner />}
          {pending ? "Menyimpan…" : submit}
        </button>
      </div>
    </form>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4 animate-spin" aria-hidden>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2.5} />
      <path d="M17.5 10A7.5 7.5 0 0 0 10 2.5" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="size-4" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

/** asal: penanda butir yang sudah ada (mis. urutan lama tugas), dikirim balik apa adanya; butir baru tanpa asal. */
export type Item = { kategori?: string | null; teks: string; asal?: number };

/**
 * Editable list of text items (tugas, fungsi, indikator, ...). Optionally each item has a kategori.
 * The value is submitted as JSON in a hidden input named `name`.
 */
export function ListEditor({
  name,
  initial,
  kategori,
  placeholder = "Tulis butir…",
  addLabel = "Tambah butir",
}: {
  name: string;
  initial: Item[];
  kategori?: string[];
  placeholder?: string;
  addLabel?: string;
}) {
  const [items, setItems] = useState<(Item & { key: number })[]>(() => initial.map((it, i) => ({ ...it, key: i })));
  const [next, setNext] = useState(initial.length);
  const update = (i: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) =>
    setItems((xs) => {
      const ys = [...xs];
      [ys[i], ys[i + d]] = [ys[i + d], ys[i]];
      return ys;
    });
  const add = () => {
    setItems((xs) => [...xs, { key: next, teks: "", kategori: kategori ? (xs.at(-1)?.kategori ?? "") : undefined }]);
    setNext((n) => n + 1);
  };
  const value = kategori ? items.map(({ kategori: k, teks, asal }) => ({ kategori: k || null, teks, asal })) : items.map((x) => x.teks);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(value)} />
      {items.length === 0 && <p className="text-sm text-slate-500">Belum ada butir.</p>}
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={it.key} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
            <span className="mt-2 w-6 shrink-0 text-right text-xs tabular-nums text-slate-400">{i + 1}.</span>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              {kategori && (
                <select
                  value={it.kategori ?? ""}
                  onChange={(e) => update(i, { kategori: e.target.value })}
                  aria-label={`Kategori butir ${i + 1}`}
                  className="field h-9 sm:w-48"
                >
                  <option value="">(tanpa kategori)</option>
                  {kategori.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              )}
              <textarea
                value={it.teks}
                onChange={(e) => update(i, { teks: e.target.value })}
                placeholder={placeholder}
                aria-label={`Butir ${i + 1}`}
                rows={Math.min(6, Math.max(1, Math.ceil(it.teks.length / 110)))}
                className="field h-auto min-h-9 flex-1 resize-y py-1.5 leading-relaxed"
              />
            </div>
            <div className="flex shrink-0">
              <IconButton label="Naikkan" onClick={() => move(i, -1)} disabled={i === 0}>
                <path d="M10 15V5M5.5 9.5 10 5l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </IconButton>
              <IconButton label="Turunkan" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                <path d="M10 5v10M5.5 10.5 10 15l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
              </IconButton>
              <IconButton label="Hapus butir" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>
                <path d="M5 6.5h10M8 6.5V5h4v1.5M6.5 6.5l.6 9h5.8l.6-9" strokeLinecap="round" strokeLinejoin="round" />
              </IconButton>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={add} className="btn-secondary h-9 text-[13px]">
        + {addLabel}
      </button>
    </div>
  );
}

export type KompetensiOption = { id: number; kode: string; nama: string; bidang: string; kategori: string; maxLevel: number };

/** Edit the kompetensi + level target list of one jabatan. */
export type DasarPemetaan = { alasan: string | null; metode: string | null; bukti: number[] };

export function PemetaanEditor({
  name,
  options,
  initial,
  levelDefault,
  dasar = {},
  tugas = [],
}: {
  name: string;
  options: KompetensiOption[];
  initial: { kompetensi_id: number; level_target: number }[];
  levelDefault: number;
  /** alasan & bukti usulan per kompetensi_id (ditampilkan di bawah nama) */
  dasar?: Record<number, DasarPemetaan>;
  /** uraian tugas jobdesk utama, untuk menampilkan isi butir bukti */
  tugas?: string[];
}) {
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const [rows, setRows] = useState(initial);
  const [cari, setCari] = useState("");
  const dipakai = new Set(rows.map((r) => r.kompetensi_id));
  const term = cari.trim().toLowerCase();
  const kandidat = options.filter((o) => !dipakai.has(o.id) && (!term || `${o.kode} ${o.nama} ${o.bidang}`.toLowerCase().includes(term))).slice(0, 40);
  const URUT = ["inti", "kepemimpinan", "teknis"];
  const sorted = [...rows].sort((a, b) => {
    const x = byId.get(a.kompetensi_id)!;
    const y = byId.get(b.kompetensi_id)!;
    return URUT.indexOf(x.kategori) - URUT.indexOf(y.kategori) || x.kode.localeCompare(y.kode, "id", { numeric: true });
  });

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Kompetensi</th>
              <th className="w-40 px-3 py-2 font-medium">Level target</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                  Belum ada kompetensi. Tambahkan dari kotak di bawah.
                </td>
              </tr>
            )}
            {sorted.map((r) => {
              const o = byId.get(r.kompetensi_id)!;
              return (
                <tr key={r.kompetensi_id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <span className="mr-2 font-mono text-xs text-slate-500">{o.kode}</span>
                    {o.nama}
                    {dasar[r.kompetensi_id]?.metode === "ai" && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        <span className="mr-1 rounded bg-slate-100 px-1 font-medium text-slate-600">AI</span>
                        {dasar[r.kompetensi_id].alasan}
                        {dasar[r.kompetensi_id].bukti.length > 0 && (
                          <span
                            className="ml-1 cursor-help text-brand-700 underline decoration-dotted"
                            title={dasar[r.kompetensi_id].bukti.map((n) => `${n}. ${tugas[n - 1] ?? "?"}`).join("\n")}
                          >
                            (tugas {dasar[r.kompetensi_id].bukti.join(", ")})
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={r.level_target}
                      aria-label={`Level target ${o.kode}`}
                      onChange={(e) => setRows((xs) => xs.map((x) => (x.kompetensi_id === r.kompetensi_id ? { ...x, level_target: Number(e.target.value) } : x)))}
                      className="field h-9 w-full"
                    >
                      {[1, 2, 3, 4, 5].map((lv) => (
                        <option key={lv} value={lv} disabled={lv > o.maxLevel}>
                          {lv} · {["Dasar", "Memadai", "Mandiri", "Mahir", "Master"][lv - 1]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1">
                    <IconButton label={`Hapus ${o.kode}`} onClick={() => setRows((xs) => xs.filter((x) => x.kompetensi_id !== r.kompetensi_id))}>
                      <path d="M5 6.5h10M8 6.5V5h4v1.5M6.5 6.5l.6 9h5.8l.6-9" strokeLinecap="round" strokeLinejoin="round" />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
        <label className="field-label">
          Tambah kompetensi
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kode, nama, atau bidang…" className="field" />
        </label>
        {term && (
          <ul className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white text-sm">
            {kandidat.length === 0 && <li className="px-3 py-2 text-slate-500">Tidak ada kompetensi yang cocok.</li>}
            {kandidat.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setRows((xs) => [...xs, { kompetensi_id: o.id, level_target: Math.min(levelDefault, o.maxLevel) }]);
                    setCari("");
                  }}
                  className="flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-brand-50"
                >
                  <span className="font-mono text-xs text-slate-500">{o.kode}</span>
                  <span className="flex-1">{o.nama}</span>
                  <span className="text-xs text-slate-500">{o.bidang}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

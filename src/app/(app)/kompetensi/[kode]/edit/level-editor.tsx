"use client";

import { useState } from "react";
import { ListEditor, type Item } from "@/components/editors";

/** Tabs L1–L5; every panel stays mounted (only hidden) so all levels are submitted together. */
export function LevelEditor({ levels, namaLevel }: { levels: { level: number; deskripsi: string; indikator: Item[] }[]; namaLevel: string[] }) {
  const [aktif, setAktif] = useState(1);
  return (
    <div>
      <div role="tablist" aria-label="Level" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-3">
        {levels.map((l) => (
          <button
            key={l.level}
            type="button"
            role="tab"
            aria-selected={aktif === l.level}
            onClick={() => setAktif(l.level)}
            className={`-mb-px whitespace-nowrap rounded-t-lg border px-3 py-2 text-sm font-medium transition-colors ${
              aktif === l.level ? "border-slate-200 border-b-white bg-white text-brand-800" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            L{l.level} · {namaLevel[l.level - 1]}
            <span className="ml-1.5 text-xs text-slate-400">{l.indikator.length}</span>
          </button>
        ))}
      </div>
      {levels.map((l) => (
        <div key={l.level} role="tabpanel" hidden={aktif !== l.level} className="space-y-4 p-4">
          <label className="field-label">
            Deskripsi level {l.level}
            <textarea name={`deskripsi-${l.level}`} defaultValue={l.deskripsi} rows={2} className="field h-auto py-2 leading-relaxed" />
          </label>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Indikator perilaku</div>
            <ListEditor name={`indikator-${l.level}`} initial={l.indikator} placeholder="Indikator perilaku" addLabel="Tambah indikator" />
          </div>
        </div>
      ))}
    </div>
  );
}

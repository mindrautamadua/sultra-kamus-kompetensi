import { ActionForm } from "@/components/editors";
import { simpanJabatan } from "@/lib/actions";
import { JENJANG_LABEL } from "@/lib/labels";
import { must, supabase } from "@/lib/supabase";

const KELOMPOK = ["Direksi", "Kepala Divisi", "Pemimpin Kantor", "Kepala Bagian", "Ketua Kelompok", "Kepala Seksi", "Koordinator", "Pelaksana"];

type Nilai = {
  id?: number;
  nama?: string;
  unit_kerja_id?: number | null;
  atasan_id?: number | null;
  jenjang?: number | null;
  kelompok_jabatan?: string | null;
  catatan?: string | null;
};

/** Create/edit form for a jabatan (shared by /jabatan/baru and /jabatan/[kode]/edit). */
export async function FormJabatan({ nilai, submit }: { nilai: Nilai; submit: string }) {
  const [units, jabatan] = await Promise.all([
    supabase.from("unit_kerja").select("id, kode, nama, parent_id").order("urutan").then(must),
    supabase.from("v_jabatan").select("id, nama, unit_induk_nama").order("urutan").then(must),
  ]);

  // unit tree order with indentation
  const children = new Map<number | null, typeof units>();
  for (const u of units) children.set(u.parent_id, [...(children.get(u.parent_id) ?? []), u]);
  const tree: { u: (typeof units)[number]; depth: number }[] = [];
  const walk = (p: number | null, depth: number) => {
    for (const u of children.get(p) ?? []) {
      tree.push({ u, depth });
      walk(u.id, depth + 1);
    }
  };
  walk(null, 0);

  const atasanGroups = new Map<string, typeof jabatan>();
  for (const j of jabatan) if (j.id !== nilai.id) atasanGroups.set(j.unit_induk_nama ?? "-", [...(atasanGroups.get(j.unit_induk_nama ?? "-") ?? []), j]);

  return (
    <ActionForm action={simpanJabatan} submit={submit}>
      {nilai.id && <input type="hidden" name="id" value={nilai.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field-label md:col-span-2">
          Nama jabatan
          <input name="nama" required defaultValue={nilai.nama ?? ""} placeholder="mis. Pelaksana Analis Kredit" className="field" />
        </label>
        <label className="field-label">
          Unit kerja
          <select name="unit_kerja_id" required defaultValue={nilai.unit_kerja_id ?? ""} className="field">
            <option value="" disabled>
              Pilih unit…
            </option>
            {tree.map(({ u, depth }) => (
              <option key={u.id} value={u.id}>
                {"  ".repeat(depth)}
                {u.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Atasan langsung
          <select name="atasan_id" defaultValue={nilai.atasan_id ?? ""} className="field">
            <option value="">(tidak ada)</option>
            {[...atasanGroups].map(([g, js]) => (
              <optgroup key={g} label={g}>
                {js.map((j) => (
                  <option key={j.id} value={j.id!}>
                    {j.nama}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field-label">
          Kelompok jabatan
          <select name="kelompok_jabatan" defaultValue={nilai.kelompok_jabatan ?? ""} className="field">
            <option value="">(otomatis dari nama)</option>
            {KELOMPOK.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Jenjang
          <select name="jenjang" defaultValue={nilai.jenjang ?? ""} className="field">
            <option value="">(otomatis dari nama)</option>
            {Object.entries(JENJANG_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {k} · {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label md:col-span-2">
          Catatan
          <textarea name="catatan" defaultValue={nilai.catatan ?? ""} rows={2} className="field h-auto py-2" />
        </label>
      </div>
    </ActionForm>
  );
}

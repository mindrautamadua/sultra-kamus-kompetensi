"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/actions";
import { wajibLogin } from "@/lib/auth";
import { BATAS_ANGKA } from "@/lib/pengaturan";
import { bolehKelolaAkun, TIDAK_BERHAK } from "@/lib/peran";
import { admin, ok } from "@/lib/supabase-admin";

// Server Actions halaman Admin › Pengaturan (khusus admin). Tiap kartu menyimpan kolomnya sendiri.

async function simpan(id: number, isi: Record<string, string | number>): Promise<FormState> {
  try {
    ok(await admin().from("pengaturan").upsert({ id: true, ...isi, diubah_oleh: id }).select("id"));
  } catch (e) {
    return { error: `Gagal menyimpan: ${(e as Error).message}` };
  }
  // judul edisi tampil di sidebar semua halaman
  revalidatePath("/", "layout");
  return { pesan: "Tersimpan." };
}

export async function simpanTampilan(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  if (!bolehKelolaAkun(s.peran)) return { error: TIDAK_BERHAK };
  const edisi_judul = String(fd.get("edisi_judul") ?? "").trim();
  const edisi_keterangan = String(fd.get("edisi_keterangan") ?? "").trim();
  if (!edisi_judul || edisi_judul.length > 80) return { error: "Judul edisi wajib diisi, maksimal 80 karakter." };
  if (edisi_keterangan.length > 160) return { error: "Keterangan maksimal 160 karakter." };
  return simpan(s.id, { edisi_judul, edisi_keterangan });
}

export async function simpanKeamanan(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  if (!bolehKelolaAkun(s.peran)) return { error: TIDAK_BERHAK };
  const isi: Record<string, number> = {};
  for (const [k, b] of Object.entries(BATAS_ANGKA)) {
    const n = Number(fd.get(k));
    if (!Number.isInteger(n) || n < b.min || n > b.max) return { error: `${b.label} harus bilangan bulat ${b.min}–${b.max}.` };
    isi[k] = n;
  }
  return simpan(s.id, isi);
}

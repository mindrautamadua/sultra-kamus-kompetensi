import "server-only";
import type { Sesi } from "@/lib/sesi";
import { admin } from "@/lib/supabase-admin";

// Pemeriksaan pencabutan sesi untuk proxy.ts: akun masih aktif dan versi sesinya sama dengan di database.
// Proxy berjalan di setiap permintaan (termasuk prefetch), jadi hasilnya disimpan sebentar per akun.
// Server Actions & penggunaSaatIni() tetap membaca database langsung, tanpa jeda ini.

const TTL_MS = 15_000;
const simpanan = new Map<number, { versi: number | null; sampai: number }>();

/** Versi sesi akun yang masih aktif, atau null bila akun nonaktif/tidak ada. `segar`: abaikan simpanan. */
async function versiAktif(id: number, segar = false) {
  const ada = simpanan.get(id);
  if (!segar && ada && ada.sampai > Date.now()) return ada.versi;
  const { data, error } = await admin().from("pengguna").select("aktif, sesi_versi").eq("id", id).maybeSingle();
  // galat database jangan mengeluarkan semua orang; halaman & Server Actions tetap memeriksa lewat penggunaSaatIni()
  if (error) return undefined;
  const versi = data?.aktif ? data.sesi_versi : null;
  simpanan.set(id, { versi, sampai: Date.now() + TTL_MS });
  return versi;
}

export async function sesiBerlaku(s: Sesi) {
  let versi = await versiAktif(s.id);
  // versi naik sesudah simpanan dibuat (mis. baru ganti password; token sesi ini sudah diperbarui): baca ulang,
  // jangan langsung keluarkan pengguna. Token dengan versi lebih lama memang sudah dicabut.
  if (typeof versi === "number" && s.v > versi) versi = await versiAktif(s.id, true);
  return versi === undefined || versi === s.v;
}

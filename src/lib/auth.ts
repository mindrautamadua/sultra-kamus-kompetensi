import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { bolehEdit, type Peran } from "@/lib/peran";
import { admin } from "@/lib/supabase-admin";
import { bacaToken, buatToken, COOKIE_SESI, type Sesi } from "@/lib/sesi";

// Lapisan akses sesi. proxy.ts hanya memeriksa tanda tangan cookie (cepat, tanpa database);
// wajibLogin() dipakai Server Actions dan juga memastikan akun masih aktif dan sesinya belum dicabut di database.

/** Sesi dari cookie (tanpa cek database) — untuk tampilan, mis. nama pengguna di sidebar. */
export async function sesiSaatIni() {
  return bacaToken((await cookies()).get(COOKIE_SESI)?.value);
}

/**
 * Akun yang login beserta perannya, dibaca dari database sekali per permintaan. Peran tidak disimpan di cookie
 * agar perubahan peran / penonaktifan oleh admin langsung berlaku. null bila belum login atau akun nonaktif.
 */
export const penggunaSaatIni = cache(async () => {
  const s = await sesiSaatIni();
  if (!s) return null;
  const { data, error } = await admin().from("pengguna").select("id, username, nama, peran, aktif, sesi_versi").eq("id", s.id).maybeSingle();
  // galat database (mis. migrasi peran belum dijalankan) jangan dianggap "belum login": itu memicu redirect berulang
  if (error) throw new Error(`Gagal membaca akun: ${error.message}`);
  // versi berbeda = password diganti/direset atau akun pernah dinonaktifkan sesudah token ini dibuat
  return data?.aktif && data.sesi_versi === s.v ? { id: data.id, username: data.username, nama: data.nama, peran: data.peran as Peran } : null;
});

/** Buat token sesi dan simpan di cookie. Tanpa "Ingat saya" cookie tidak diberi maxAge, jadi terhapus saat browser ditutup. */
export async function pasangSesi(s: Omit<Sesi, "exp">, lamaDetik: number) {
  (await cookies()).set(COOKIE_SESI, await buatToken(s, lamaDetik), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(s.ingat ? { maxAge: lamaDetik } : {}),
  });
}

/** Wajib dipanggil di awal setiap Server Action yang mengubah data; hak per peran diperiksa sesudahnya. */
export async function wajibLogin() {
  const p = await penggunaSaatIni();
  if (!p) redirect("/login");
  return p;
}

/** Untuk halaman edit: akun yang tidak berhak mengedit dikembalikan ke halaman baca `kembali`. */
export async function wajibEditor(kembali: string) {
  const p = await wajibLogin();
  if (!bolehEdit(p.peran)) redirect(kembali);
  return p;
}

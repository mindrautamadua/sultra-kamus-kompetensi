"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/actions";
import { pasangSesi, sesiSaatIni, wajibLogin } from "@/lib/auth";
import { cocokPassword, hashPassword, passwordAcak } from "@/lib/password";
import { bacaPengaturan } from "@/lib/pengaturan";
import { bolehKelolaAkun, PERAN, type Peran, TIDAK_BERHAK } from "@/lib/peran";
import { admin, ok } from "@/lib/supabase-admin";

// Server Actions halaman Pengguna (khusus admin) dan Akun Saya. Password baru dibuat acak di server dan
// dikembalikan sekali lewat `pesan`; yang tersimpan hanya hash-nya. Mengganti/mereset password dan menonaktifkan akun
// mencabut semua sesi akun itu (trigger sesi_versi di database).

async function wajibAdmin() {
  const s = await wajibLogin();
  return bolehKelolaAkun(s.peran) ? s : null;
}

/** Jumlah admin aktif selain `kecuali`, agar akun admin terakhir tidak bisa dinonaktifkan/diturunkan. */
async function adminLain(kecuali: number) {
  const { count } = await admin().from("pengguna").select("id", { count: "exact", head: true }).eq("peran", "admin").eq("aktif", true).neq("id", kecuali);
  return count ?? 0;
}

export async function tambahPengguna(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await wajibAdmin())) return { error: TIDAK_BERHAK };
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const nama = String(fd.get("nama") ?? "").trim();
  const peran = String(fd.get("peran") ?? "") as Peran;
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return { error: "Username 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip." };
  if (!nama) return { error: "Nama lengkap wajib diisi." };
  if (!PERAN.includes(peran)) return { error: "Pilih peran." };
  const password = passwordAcak();
  const { error } = await admin().from("pengguna").insert({ username, nama, peran, password_hash: await hashPassword(password) });
  if (error) return { error: error.code === "23505" ? `Username "${username}" sudah dipakai.` : `Gagal membuat akun: ${error.message}` };
  revalidatePath("/admin/pengguna");
  return { pesan: `Akun ${username} dibuat. Password awal: ${password} — catat sekarang, hanya ditampilkan sekali.` };
}

export async function ubahPengguna(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibAdmin();
  if (!s) return { error: TIDAK_BERHAK };
  const id = Number(fd.get("id"));
  const peran = String(fd.get("peran") ?? "") as Peran;
  const aktif = fd.get("aktif") === "on";
  if (!PERAN.includes(peran)) return { error: "Pilih peran." };
  if (id === s.id && (peran !== s.peran || !aktif)) return { error: "Peran dan status akun Anda sendiri tidak bisa diubah di sini — minta admin lain." };
  try {
    const lama = ok(await admin().from("pengguna").select("peran, aktif").eq("id", id).single());
    if (lama.peran === "admin" && lama.aktif && (peran !== "admin" || !aktif) && !(await adminLain(id))) return { error: "Harus tersisa minimal satu admin aktif." };
    ok(await admin().from("pengguna").update({ peran, aktif, updated_at: new Date().toISOString() }).eq("id", id).select("id"));
  } catch (e) {
    return { error: `Gagal menyimpan: ${(e as Error).message}` };
  }
  revalidatePath("/admin/pengguna");
  return { pesan: "Tersimpan." };
}

export async function resetPasswordPengguna(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await wajibAdmin())) return { error: TIDAK_BERHAK };
  const id = Number(fd.get("id"));
  const password = passwordAcak();
  try {
    const u = ok(
      await admin()
        .from("pengguna")
        .update({ password_hash: await hashPassword(password), gagal_login: 0, terkunci_sampai: null, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("username")
        .single(),
    );
    revalidatePath("/admin/pengguna");
    return { pesan: `Password baru ${u.username}: ${password} — catat sekarang, hanya ditampilkan sekali.` };
  } catch (e) {
    return { error: `Gagal mereset password: ${(e as Error).message}` };
  }
}

export async function gantiPasswordSaya(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  const lama = String(fd.get("lama") ?? "");
  const baru = String(fd.get("baru") ?? "");
  const { panjang_password_min: min } = await bacaPengaturan();
  if (baru.length < min) return { error: `Password baru minimal ${min} karakter.` };
  if (baru !== String(fd.get("ulang") ?? "")) return { error: "Ulangi password baru dengan sama persis." };
  if (baru === lama) return { error: "Password baru harus berbeda dari yang lama." };
  try {
    const u = ok(await admin().from("pengguna").select("password_hash").eq("id", s.id).single());
    if (!(await cocokPassword(lama, u.password_hash))) return { error: "Password saat ini salah." };
    const { sesi_versi } = ok(
      await admin().from("pengguna").update({ password_hash: await hashPassword(baru), updated_at: new Date().toISOString() }).eq("id", s.id).select("sesi_versi").single(),
    );
    // sesi di perangkat lain dicabut; sesi ini diperbarui ke versi baru dengan sisa masa berlaku yang sama
    const kini = await sesiSaatIni();
    if (kini) await pasangSesi({ id: kini.id, username: kini.username, nama: kini.nama, v: sesi_versi, ingat: kini.ingat }, Math.max(60, kini.exp - Math.floor(Date.now() / 1000)));
  } catch (e) {
    return { error: `Gagal mengganti password: ${(e as Error).message}` };
  }
  return { pesan: "Password berhasil diganti. Sesi di perangkat lain sudah dikeluarkan." };
}

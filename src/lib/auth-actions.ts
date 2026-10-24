"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cocokPassword, HASH_TIRUAN } from "@/lib/password";
import { bacaPengaturan } from "@/lib/pengaturan";
import { buatToken, COOKIE_SESI } from "@/lib/sesi";
import { admin } from "@/lib/supabase-admin";

export type LoginState = { error?: string; username?: string; ingat?: boolean } | undefined;

const SALAH = "Username atau password salah.";

/** Hanya path internal ("/jabatan"), bukan "//host" atau URL lengkap. */
const tujuanAman = (dari: string) => (dari.startsWith("/") && !dari.startsWith("//") && !dari.startsWith("/\\") ? dari : "/");

export async function login(_: LoginState, fd: FormData): Promise<LoginState> {
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const dari = tujuanAman(String(fd.get("dari") ?? "/"));
  const ingat = fd.get("ingat") === "on";
  if (!username || !password) return { error: "Isi username dan password.", username, ingat };

  const db = admin();
  // batas gagal, lama kunci, dan lama sesi diatur admin di Admin › Pengaturan
  const atur = await bacaPengaturan();
  const { data: u, error } = await db
    .from("pengguna")
    .select("id, username, nama, password_hash, aktif, gagal_login, terkunci_sampai")
    .eq("username", username)
    .maybeSingle();
  if (error) return { error: `Gagal memeriksa akun: ${error.message}`, username, ingat };

  if (u?.terkunci_sampai && new Date(u.terkunci_sampai) > new Date()) {
    const menit = Math.ceil((new Date(u.terkunci_sampai).getTime() - Date.now()) / 60000);
    return { error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${menit} menit.`, username, ingat };
  }

  // tetap hitung hash meski akun tidak ada, agar lama respons sama
  const cocok = await cocokPassword(password, u?.password_hash ?? HASH_TIRUAN);
  if (!u || !u.aktif || !cocok) {
    if (u) {
      const gagal = u.gagal_login + 1;
      await db
        .from("pengguna")
        .update(
          gagal >= atur.batas_gagal_login
            ? { gagal_login: 0, terkunci_sampai: new Date(Date.now() + atur.lama_kunci_menit * 60000).toISOString() }
            : { gagal_login: gagal },
        )
        .eq("id", u.id);
    }
    return { error: SALAH, username, ingat };
  }

  await db.from("pengguna").update({ gagal_login: 0, terkunci_sampai: null, terakhir_login: new Date().toISOString() }).eq("id", u.id);
  const lamaDetik = ingat ? atur.lama_ingat_hari * 24 * 60 * 60 : atur.lama_sesi_jam * 60 * 60;
  const token = await buatToken({ id: u.id, username: u.username, nama: u.nama }, lamaDetik);
  (await cookies()).set(COOKIE_SESI, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // tanpa maxAge = cookie sesi browser, terhapus saat browser ditutup
    ...(ingat ? { maxAge: lamaDetik } : {}),
  });
  redirect(dari);
}

export async function logout() {
  (await cookies()).delete(COOKIE_SESI);
  redirect("/login");
}

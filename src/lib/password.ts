import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Hash password memakai scrypt bawaan Node. Format: scrypt$N$r$p$salt$hash (base64url).
// scripts/db/pengguna.mjs memakai format yang sama — ubah keduanya bersamaan.

const N = 16384;
const R = 8;
const P = 1;
const PANJANG = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, PANJANG, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function cocokPassword(password: string, hash: string) {
  const [alg, n, r, p, salt, key] = hash.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const want = Buffer.from(key, "base64url");
  const got = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return got.length === want.length && timingSafeEqual(got, want);
}

/** 16 karakter acak tanpa huruf yang mudah tertukar (0/O, 1/l/I) — sama dengan scripts/db/pengguna.mjs. */
export function passwordAcak() {
  const abjad = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return [...randomBytes(16)].map((b) => abjad[b % abjad.length]).join("");
}

/** Hash tiruan untuk username yang tidak ada, agar waktu respons login tidak membocorkan keberadaan akun. */
export const HASH_TIRUAN = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86);

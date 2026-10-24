// Token sesi login: payload JSON (base64url) + tanda tangan HMAC-SHA256 dengan SESSION_SECRET.
// Memakai Web Crypto agar bisa dipakai di proxy.ts maupun Server Components/Actions.

export const COOKIE_SESI = "kk_sesi";
// Lama sesi (dengan/tanpa "Ingat saya") diatur admin di tabel pengaturan, lihat src/lib/pengaturan.ts.

export type Sesi = { id: number; username: string; nama: string; exp: number };

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

let kunci: Promise<CryptoKey> | undefined;
function getKunci() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET belum diisi di .env.local (minimal 32 karakter).");
  kunci ??= crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return kunci;
}

export async function buatToken(s: Omit<Sesi, "exp">, lamaDetik: number) {
  const payload = b64url(enc.encode(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + lamaDetik })));
  const sig = await crypto.subtle.sign("HMAC", await getKunci(), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

/** null bila token kosong, rusak, tanda tangan salah, atau kedaluwarsa. */
export async function bacaToken(token: string | undefined): Promise<Sesi | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const sah = await crypto.subtle.verify("HMAC", await getKunci(), Buffer.from(sig, "base64url"), enc.encode(payload));
    if (!sah) return null;
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Sesi;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}

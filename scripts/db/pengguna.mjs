// Kelola akun login aplikasi (tabel public.pengguna) memakai service role dari .env.local.
//   npm run pengguna -- daftar
//   npm run pengguna -- tambah <username> "<Nama Lengkap>" [peran]   -> password acak dicetak sekali
//   npm run pengguna -- peran <username> <admin|editor|pembaca>
//   npm run pengguna -- reset <username>                     -> password acak baru + buka kunci
//   npm run pengguna -- nonaktif|aktif <username>
import { randomBytes, scrypt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Format harus sama dengan src/lib/password.ts: scrypt$N$r$p$salt$hash (base64url)
const N = 16384, R = 8, P = 1, PANJANG = 64;
function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, PANJANG, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$")),
    ),
  );
}
// 16 karakter tanpa huruf yang mudah tertukar (0/O, 1/l/I)
function passwordAcak() {
  const abjad = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return [...randomBytes(16)].map((b) => abjad[b % abjad.length]).join("");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });
const ok = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

const [perintah, usernameMentah, nama, peranArg] = process.argv.slice(2);
// sama dengan PERAN di src/lib/peran.ts
const PERAN = ["admin", "editor", "pembaca"];
const username = usernameMentah?.trim().toLowerCase();
console.log(`Database: ${url}`);

switch (perintah) {
  case "daftar": {
    const rows = ok(await db.from("pengguna").select("username, nama, peran, aktif, terakhir_login, terkunci_sampai").order("username"));
    if (!rows.length) console.log("Belum ada akun.");
    for (const r of rows)
      console.log(`${r.aktif ? "aktif   " : "NONAKTIF"}  ${r.username.padEnd(20)} ${r.nama.padEnd(30)} ${r.peran.padEnd(10)} login terakhir: ${r.terakhir_login ?? "-"}${r.terkunci_sampai && new Date(r.terkunci_sampai) > new Date() ? "  (TERKUNCI)" : ""}`);
    break;
  }
  case "tambah": {
    const peran = peranArg ?? "editor";
    if (!username || !nama || !PERAN.includes(peran)) throw new Error(`Pakai: npm run pengguna -- tambah <username> "<Nama Lengkap>" [${PERAN.join("|")}]`);
    const password = passwordAcak();
    ok(await db.from("pengguna").insert({ username, nama: nama.trim(), peran, password_hash: await hashPassword(password) }).select("id"));
    console.log(`Akun dibuat: ${username} (${peran})\nPassword   : ${password}\n(dicetak sekali ini saja — berikan ke pengguna lewat jalur aman)`);
    break;
  }
  case "reset": {
    if (!username) throw new Error("Pakai: npm run pengguna -- reset <username>");
    const password = passwordAcak();
    const rows = ok(
      await db.from("pengguna").update({ password_hash: await hashPassword(password), gagal_login: 0, terkunci_sampai: null }).eq("username", username).select("id"),
    );
    if (!rows.length) throw new Error(`Akun ${username} tidak ditemukan.`);
    console.log(`Password baru ${username}: ${password}`);
    break;
  }
  case "peran": {
    // argumen ke-3 dipakai sebagai peran: npm run pengguna -- peran <username> <peran>
    if (!username || !PERAN.includes(nama)) throw new Error(`Pakai: npm run pengguna -- peran <username> <${PERAN.join("|")}>`);
    const rows = ok(await db.from("pengguna").update({ peran: nama }).eq("username", username).select("id"));
    if (!rows.length) throw new Error(`Akun ${username} tidak ditemukan.`);
    console.log(`${username}: ${nama}`);
    break;
  }
  case "aktif":
  case "nonaktif": {
    if (!username) throw new Error(`Pakai: npm run pengguna -- ${perintah} <username>`);
    const rows = ok(await db.from("pengguna").update({ aktif: perintah === "aktif" }).eq("username", username).select("id"));
    if (!rows.length) throw new Error(`Akun ${username} tidak ditemukan.`);
    console.log(`${username}: ${perintah}`);
    break;
  }
  default:
    console.log("Perintah: daftar | tambah <username> \"<Nama>\" [peran] | peran <username> <peran> | reset <username> | aktif <username> | nonaktif <username>");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { wajibLogin } from "@/lib/auth";
import { PENILAIAN_DIRI_AKTIF } from "@/lib/fitur";
import { hitungLevel, kunciIndikator } from "@/lib/penilaian";
import { REVIEW_LABEL } from "@/lib/labels";
import { bolehEdit, statusTujuan, TIDAK_BERHAK } from "@/lib/peran";
import { admin, ok } from "@/lib/supabase-admin";

// Server Actions for the edit pages. Each returns { error } on failure (shown by the form via useActionState)
// and redirects back to the detail page on success. Lists from the client editors arrive as JSON strings.
// Saves that delete and re-insert child rows go through one database function each (migration simpan_atomik),
// so a failure halfway cannot leave them deleted.

/** `pesan`: keterangan sukses yang tetap tampil di form (mis. password baru), untuk aksi yang tidak redirect. */
export type FormState = { error?: string; pesan?: string } | undefined;

const now = () => new Date().toISOString();
const text = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
};
const json = <T,>(fd: FormData, k: string): T => JSON.parse(String(fd.get(k) || "[]"));
const lines = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);

function kelompokDari(nama: string) {
  const n = nama.toLowerCase();
  const map: [string, string, number][] = [
    ["direktur", "Direksi", 0],
    ["pemimpin", "Pemimpin Kantor", 1],
    ["kepala divisi", "Kepala Divisi", 1],
    ["kepala satuan", "Kepala Divisi", 1],
    ["kepala bagian", "Kepala Bagian", 2],
    ["ketua", "Ketua Kelompok", 2],
    ["kepala seksi", "Kepala Seksi", 3],
    ["koordinator", "Koordinator", 3],
    ["head teller", "Koordinator", 3],
  ];
  const m = map.find(([p]) => n.startsWith(p));
  return m ? { kelompok: m[1], jenjang: m[2] } : { kelompok: "Pelaksana", jenjang: 4 };
}

function refreshAll() {
  revalidatePath("/", "layout");
}

type Db = ReturnType<typeof admin>;
type Pelaku = Awaited<ReturnType<typeof wajibLogin>>;

/**
 * Catat penyimpanan dari editor ke riwayat review. Jabatan yang sudah ditandai selesai kembali ke draf karena
 * isinya berubah dan perlu ditandai selesai ulang.
 */
async function catatEdit(db: Db, jabatanId: number, aksi: string, pelaku: Pelaku) {
  // dipanggil sesudah data tersimpan: kegagalan mencatat riwayat jangan dilaporkan sebagai "gagal menyimpan"
  try {
    await catatEditRiwayat(db, jabatanId, aksi, pelaku);
  } catch (e) {
    console.error(`Riwayat review jabatan ${jabatanId} (${aksi}) gagal dicatat:`, e);
  }
}

async function catatEditRiwayat(db: Db, jabatanId: number, aksi: string, pelaku: Pelaku) {
  const peninjau = pelaku.nama;
  const r = (await db.from("review_jabatan").select("status").eq("jabatan_id", jabatanId).maybeSingle()).data;
  const dari = r?.status ?? "draf";
  const ke = "draf";
  const catatan = dari === "selesai" ? "Diedit setelah ditandai selesai — perlu ditandai selesai ulang." : null;
  if (ke !== dari) ok(await db.from("review_jabatan").upsert({ jabatan_id: jabatanId, status: ke, peninjau, catatan, updated_at: now() }).select("jabatan_id"));
  ok(await db.from("review_riwayat").insert({ jabatan_id: jabatanId, aksi, status_dari: dari, status_ke: ke, peninjau, pengguna_id: pelaku.id, catatan }).select("id"));
}

// ---------- review

export async function ubahStatusReview(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  const db = admin();
  const jabatanId = Number(fd.get("jabatan_id"));
  const status = String(fd.get("status") ?? "");
  const peninjau = s.nama;
  const catatan = text(fd, "catatan");
  if (!["draf", "selesai"].includes(status)) return { error: "Pilih status baru." };
  let kode: string;
  try {
    const j = ok(await db.from("v_jabatan").select("kode, jumlah_kompetensi").eq("id", jabatanId).single());
    kode = j.kode!;
    if (status === "selesai" && !j.jumlah_kompetensi) return { error: "Jabatan belum punya kompetensi — belum bisa ditandai selesai." };
    const dari = (await db.from("review_jabatan").select("status").eq("jabatan_id", jabatanId).maybeSingle()).data?.status ?? "draf";
    // dikirim dua kali / dari tab lain yang sudah usang
    if (dari === status) return { error: `Jabatan ini sudah berstatus ${REVIEW_LABEL[status]}. Muat ulang halaman.` };
    if (!statusTujuan(s.peran, dari).includes(status)) return { error: TIDAK_BERHAK };
    ok(await db.from("review_jabatan").upsert({ jabatan_id: jabatanId, status, peninjau, catatan, updated_at: now() }).select("jabatan_id"));
    ok(await db.from("review_riwayat").insert({ jabatan_id: jabatanId, aksi: "ubah_status", status_dari: dari, status_ke: status, peninjau, pengguna_id: s.id, catatan }).select("id"));
  } catch (e) {
    return { error: `Gagal mengubah status: ${(e as Error).message}` };
  }
  refreshAll();
  // "lanjut": buka jabatan berikutnya di antrean status asal (terlama dulu), agar konsultan tidak bolak-balik ke daftar
  if (fd.get("lanjut") === "on") {
    const berikut = await jabatanBerikutnya(db, String(fd.get("antrean") ?? ""), jabatanId);
    redirect(berikut ? `/jabatan/${berikut}#review` : "/review");
  }
  redirect(`/jabatan/${kode}#review`);
}

/** Kode jabatan berikutnya berstatus `status`, urut struktur organisasi (jabatan yang belum pernah disentuh dulu). */
async function jabatanBerikutnya(db: Db, status: string, kecuali: number) {
  const { data } = await db
    .from("v_review_jabatan")
    .select("kode")
    .eq("status", status)
    .neq("jabatan_id", kecuali)
    .order("updated_at", { ascending: true, nullsFirst: true })
    .order("urutan")
    .limit(1)
    .maybeSingle();
  return data?.kode ?? null;
}

/**
 * Tandai banyak jabatan selesai sekaligus dari halaman Tandai Selesai Massal. Tiap jabatan tetap diperiksa
 * sendiri-sendiri (masih draf dan sudah punya kompetensi) dan dicatat di riwayatnya masing-masing; yang tidak
 * lolos dilewati, bukan menggagalkan semuanya.
 */
export async function tandaiSelesaiMassal(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  if (!bolehEdit(s.peran)) return { error: TIDAK_BERHAK };
  const ids = [...new Set(fd.getAll("jabatan_id").map(Number).filter(Boolean))];
  if (!ids.length) return { error: "Pilih minimal satu jabatan." };
  if (fd.get("yakin") !== "on") return { error: "Centang konfirmasi bahwa pemetaan jabatan terpilih sudah diperiksa." };
  const catatan = text(fd, "catatan");
  const db = admin();
  try {
    const [jabatan, review] = await Promise.all([
      db.from("v_jabatan").select("id, jumlah_kompetensi").in("id", ids).then(ok),
      db.from("review_jabatan").select("jabatan_id, status").in("jabatan_id", ids).then(ok),
    ]);
    const statusDari = new Map(review.map((r) => [r.jabatan_id, r.status]));
    const adaKompetensi = new Set(jabatan.filter((j) => j.jumlah_kompetensi).map((j) => j.id));
    const lolos = ids.filter((id) => adaKompetensi.has(id) && (statusDari.get(id) ?? "draf") === "draf");
    if (lolos.length) {
      const waktu = now();
      ok(await db.from("review_jabatan").upsert(lolos.map((id) => ({ jabatan_id: id, status: "selesai", peninjau: s.nama, catatan, updated_at: waktu }))).select("jabatan_id"));
      ok(
        await db
          .from("review_riwayat")
          .insert(lolos.map((id) => ({ jabatan_id: id, aksi: "selesai_massal", status_dari: "draf", status_ke: "selesai", peninjau: s.nama, pengguna_id: s.id, catatan })))
          .select("id"),
      );
    }
    refreshAll();
    const lewat = ids.length - lolos.length;
    return lolos.length
      ? { pesan: `${lolos.length} jabatan ditandai selesai.${lewat ? ` ${lewat} dilewati karena sudah selesai atau belum punya kompetensi.` : ""}` }
      : { error: "Tidak ada jabatan terpilih yang bisa ditandai selesai (sudah selesai atau belum punya kompetensi)." };
  } catch (e) {
    return { error: `Gagal menandai selesai: ${(e as Error).message}` };
  }
}

// ---------- jabatan

export async function simpanJabatan(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  if (!bolehEdit(s.peran)) return { error: TIDAK_BERHAK };
  const db = admin();
  const id = Number(fd.get("id")) || null;
  const nama = text(fd, "nama");
  const unit = Number(fd.get("unit_kerja_id"));
  if (!nama) return { error: "Nama jabatan wajib diisi." };
  if (!unit) return { error: "Unit kerja wajib dipilih." };
  const tebak = kelompokDari(nama);
  const row = {
    nama,
    unit_kerja_id: unit,
    atasan_id: Number(fd.get("atasan_id")) || null,
    jenjang: fd.get("jenjang") === "" || fd.get("jenjang") === null ? tebak.jenjang : Number(fd.get("jenjang")),
    kelompok_jabatan: text(fd, "kelompok_jabatan") ?? tebak.kelompok,
    catatan: text(fd, "catatan"),
    diubah_di_aplikasi: now(),
  };
  if (row.atasan_id && row.atasan_id === id) return { error: "Atasan tidak boleh jabatan itu sendiri." };

  let kode: string;
  try {
    if (id && row.atasan_id) {
      // telusuri garis atasan ke atas: jabatan ini tidak boleh menjadi atasan dari atasannya sendiri
      const atasan = new Map(ok(await db.from("jabatan").select("id, atasan_id")).map((j) => [j.id, j.atasan_id]));
      const dilihat = new Set<number>();
      for (let x: number | null | undefined = row.atasan_id; x && !dilihat.has(x); x = atasan.get(x)) {
        if (x === id) return { error: "Atasan yang dipilih berada di bawah jabatan ini — garis atasan akan berputar." };
        dilihat.add(x);
      }
    }
    if (id) {
      kode = ok(await db.from("jabatan").update(row).eq("id", id).select("kode").single()).kode;
      // nama di dokumen jobdesk ikut diganti agar PDF jobdesk tidak memakai nama lama
      ok(await db.from("jobdesk").update({ nama_jabatan: nama }).eq("jabatan_id", id).select("id"));
      await catatEdit(db, id, "simpan_jabatan", s);
    } else {
      // kode jabatan baru: <kode unit induk>-B<n> (B = dibuat dari aplikasi)
      const u = ok(await db.from("unit_kerja").select("kode, nama").eq("id", unit).single());
      const prefix = `${u.kode.split("-")[0]}-B`;
      const ada = ok(await db.from("jabatan").select("kode").like("kode", `${prefix}%`));
      const n = Math.max(0, ...ada.map((j) => Number(j.kode.slice(prefix.length)) || 0)) + 1;
      kode = `${prefix}${n}`;
      const urutan = ok(await db.from("jabatan").select("urutan").order("urutan", { ascending: false }).limit(1))[0]?.urutan ?? 0;
      const baru = ok(await db.from("jabatan").insert({ ...row, kode, urutan: urutan + 1 }).select("id").single());
      const jd = await db
        .from("jobdesk")
        .insert({ kelompok_unit: u.nama, nama_jabatan: nama, jabatan_id: baru.id, urutan: 100000 + baru.id, diubah_di_aplikasi: now() })
        .select("id");
      if (jd.error) {
        // batalkan jabatan yang baru dibuat, agar mencoba lagi tidak menghasilkan jabatan kembar (…-B<n+1>)
        await db.from("jabatan").delete().eq("id", baru.id);
        throw new Error(jd.error.message);
      }
      await catatEdit(db, baru.id, "buat_jabatan", s);
    }
  } catch (e) {
    return { error: `Gagal menyimpan jabatan: ${(e as Error).message}` };
  }
  refreshAll();
  redirect(`/jabatan/${kode}`);
}

export async function hapusJabatan(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  if (!bolehEdit(s.peran)) return { error: TIDAK_BERHAK };
  const id = Number(fd.get("id"));
  if (fd.get("konfirmasi") !== "HAPUS") return { error: 'Ketik HAPUS untuk mengonfirmasi.' };
  try {
    ok(await admin().from("jabatan").delete().eq("id", id).select("id"));
  } catch (e) {
    return { error: `Gagal menghapus: ${(e as Error).message}` };
  }
  refreshAll();
  redirect("/jabatan");
}

// ---------- jobdesk

export async function simpanJobdesk(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  if (!bolehEdit(s.peran)) return { error: TIDAK_BERHAK };
  const db = admin();
  const jabatanId = Number(fd.get("jabatan_id"));
  let kode: string;
  try {
    const fungsi = lines(json<string[]>(fd, "fungsi"));
    // asal = urutan lama butir (dari ListEditor), agar bukti pemetaan & penanda celah kamus ikut butirnya
    const tugas = json<{ kategori?: string | null; teks?: string; asal?: number }[]>(fd, "tugas")
      .map((t) => ({ kategori: t.kategori || null, deskripsi: String(t.teks ?? "").trim(), asal: Number.isInteger(t.asal) ? t.asal : null }))
      .filter((t) => t.deskripsi);
    const j = ok(await db.from("jabatan").select("kode, nama, unit_kerja(nama)").eq("id", jabatanId).single());
    kode = j.kode;
    const isi = {
      nama_jabatan: j.nama,
      pendidikan: text(fd, "pendidikan"),
      pendidikan_tambahan: text(fd, "pendidikan_tambahan"),
      pangkat: text(fd, "pangkat"),
      pengalaman_kerja: text(fd, "pengalaman_kerja"),
      kompetensi: text(fd, "kompetensi"),
      membawahi: lines(json<string[]>(fd, "membawahi")),
      atasan_langsung: text(fd, "atasan_langsung"),
      fungsi,
      diubah_di_aplikasi: now(),
    };
    // jobdesk utama = dokumen pertama yang tertaut ke jabatan; dibuat bila belum ada
    const ada = ok(await db.from("jobdesk").select("id, diubah_di_aplikasi").eq("jabatan_id", jabatanId).order("urutan").limit(1))[0];
    // nomor urut lama (asal) hanya bermakna terhadap versi yang dibuka; versi lain akan menggeser bukti pemetaan
    if ((ada?.diubah_di_aplikasi ?? "") !== String(fd.get("versi") ?? ""))
      return { error: "Jobdesk ini sudah diubah (di tab lain atau oleh pengguna lain) sejak halaman dibuka. Muat ulang halaman, lalu ulangi perubahan Anda." };
    const jobdeskId = ada
      ? ok(await db.from("jobdesk").update(isi).eq("id", ada.id).select("id").single()).id
      : ok(
          await db
            .from("jobdesk")
            .insert({ ...isi, kelompok_unit: j.unit_kerja?.nama ?? "-", jabatan_id: jabatanId, urutan: 100000 + jabatanId })
            .select("id")
            .single(),
        ).id;
    ok(await db.rpc("simpan_tugas_jobdesk", { p_jobdesk_id: jobdeskId, p_jabatan_id: jabatanId, p_tugas: tugas }));
    // salinan ringkas di tabel jabatan (dipakai halaman detail & ringkasan)
    ok(
      await db
        .from("jabatan")
        .update({ ikhtisar_jabatan: fungsi.join("\n") || null, uraian_tugas: tugas.map((t) => t.deskripsi), diubah_di_aplikasi: now() })
        .eq("id", jabatanId)
        .select("id"),
    );
    await catatEdit(db, jabatanId, "simpan_jobdesk", s);
  } catch (e) {
    return { error: `Gagal menyimpan jobdesk: ${(e as Error).message}` };
  }
  refreshAll();
  redirect(`/jabatan/${kode}`);
}

// ---------- pemetaan kompetensi

export async function simpanPemetaan(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  if (!bolehEdit(s.peran)) return { error: TIDAK_BERHAK };
  const db = admin();
  const jabatanId = Number(fd.get("jabatan_id"));
  let kode: string;
  try {
    const rows = json<{ kompetensi_id: number; level_target: number }[]>(fd, "pemetaan");
    if (new Set(rows.map((r) => r.kompetensi_id)).size !== rows.length) return { error: "Ada kompetensi yang tercantum dua kali." };
    // level target tidak boleh melebihi level yang tersedia di kamus kompetensi itu (sama dengan batas di PemetaanEditor)
    const maks = new Map(
      ok(await db.from("v_kompetensi").select("id, kode, jumlah_level").in("id", rows.map((r) => r.kompetensi_id))).map((k) => [k.id, { kode: k.kode, maks: k.jumlah_level || 5 }]),
    );
    const salah = rows.find((r) => !Number.isInteger(r.level_target) || r.level_target < 1 || r.level_target > (maks.get(r.kompetensi_id)?.maks ?? 5));
    if (salah) return { error: `Level target ${maks.get(salah.kompetensi_id)?.kode ?? ""} harus 1–${maks.get(salah.kompetensi_id)?.maks ?? 5}.` };
    kode = ok(await db.from("jabatan").select("kode").eq("id", jabatanId).single()).kode;
    // bukti, alasan & metode asal dipertahankan untuk kompetensi yang tetap dipilih; yang baru ditandai manual
    const lama = new Map(
      ok(await db.from("jabatan_kompetensi").select("kompetensi_id, catatan, metode, bukti").eq("jabatan_id", jabatanId)).map((r) => [r.kompetensi_id, r]),
    );
    ok(
      await db.rpc("simpan_pemetaan", {
        p_jabatan_id: jabatanId,
        p_rows: rows.map((r) => {
          const l = lama.get(r.kompetensi_id);
          return {
            kompetensi_id: r.kompetensi_id,
            level_target: r.level_target,
            catatan: l?.catatan ?? "Ditambahkan saat review di aplikasi.",
            metode: l?.metode ?? "manual",
            bukti: l?.bukti ?? [],
          };
        }),
      }),
    );
    ok(await db.from("jabatan").update({ diubah_di_aplikasi: now() }).eq("id", jabatanId).select("id"));
    await catatEdit(db, jabatanId, "simpan_kompetensi", s);
  } catch (e) {
    return { error: `Gagal menyimpan pemetaan: ${(e as Error).message}` };
  }
  refreshAll();
  redirect(`/jabatan/${kode}`);
}

/**
 * Pemetaan dari sisi kompetensi: daftar jabatan + level target untuk satu kompetensi. Hanya baris kompetensi ini yang
 * disentuh, sehingga kompetensi lain di jabatan yang sama tidak ikut berubah. Baris baru ditandai manual; baris yang
 * levelnya diubah ikut ditandai manual dengan alasan, metode & bukti asal dipertahankan.
 */
export async function simpanPemetaanKompetensi(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  if (!bolehEdit(s.peran)) return { error: TIDAK_BERHAK };
  const db = admin();
  const kompetensiId = Number(fd.get("kompetensi_id"));
  let kode: string;
  try {
    const rows = json<{ jabatan_id: number; level_target: number }[]>(fd, "pemetaan");
    if (new Set(rows.map((r) => r.jabatan_id)).size !== rows.length) return { error: "Ada jabatan yang tercantum dua kali." };
    const k = ok(await db.from("v_kompetensi").select("kode, jumlah_level").eq("id", kompetensiId).single());
    kode = k.kode!;
    const maks = k.jumlah_level || 5;
    if (rows.some((r) => !Number.isInteger(r.level_target) || r.level_target < 1 || r.level_target > maks)) return { error: `Level target harus 1–${maks}.` };

    const lama = new Map(ok(await db.from("jabatan_kompetensi").select("jabatan_id, level_target").eq("kompetensi_id", kompetensiId)).map((r) => [r.jabatan_id, r.level_target]));
    const baru = rows.filter((r) => !lama.has(r.jabatan_id));
    const ubah = rows.filter((r) => lama.has(r.jabatan_id) && lama.get(r.jabatan_id) !== r.level_target);
    const dipilih = new Set(rows.map((r) => r.jabatan_id));
    const hapus = [...lama.keys()].filter((id) => !dipilih.has(id));
    if (baru.length > 0) {
      const ada = new Set(ok(await db.from("jabatan").select("id").in("id", baru.map((r) => r.jabatan_id))).map((j) => j.id));
      if (baru.some((r) => !ada.has(r.jabatan_id))) return { error: "Ada jabatan yang sudah tidak ada. Muat ulang halaman." };
    }

    // tambah & ubah dulu, hapus terakhir: bila gagal di tengah, tidak ada pemetaan yang hilang tanpa penggantinya
    if (baru.length > 0)
      ok(
        await db
          .from("jabatan_kompetensi")
          .insert(
            baru.map((r) => ({
              jabatan_id: r.jabatan_id,
              kompetensi_id: kompetensiId,
              level_target: r.level_target,
              sumber: "manual",
              catatan: "Ditambahkan dari halaman kompetensi di aplikasi.",
              metode: "manual",
              bukti: [],
            })),
          )
          .select("id"),
      );
    for (const r of ubah)
      ok(await db.from("jabatan_kompetensi").update({ level_target: r.level_target, sumber: "manual" }).eq("jabatan_id", r.jabatan_id).eq("kompetensi_id", kompetensiId).select("id"));
    if (hapus.length > 0) ok(await db.from("jabatan_kompetensi").delete().eq("kompetensi_id", kompetensiId).in("jabatan_id", hapus).select("id"));

    const terdampak = [...baru.map((r) => r.jabatan_id), ...ubah.map((r) => r.jabatan_id), ...hapus];
    if (terdampak.length > 0) {
      ok(await db.from("jabatan").update({ diubah_di_aplikasi: now() }).in("id", terdampak).select("id"));
      for (const id of terdampak) await catatEdit(db, id, "simpan_kompetensi", s);
    }
  } catch (e) {
    return { error: `Gagal menyimpan pemetaan: ${(e as Error).message}` };
  }
  refreshAll();
  redirect(`/kompetensi/${kode}#jabatan`);
}

// ---------- kompetensi

export async function simpanKompetensi(_: FormState, fd: FormData): Promise<FormState> {
  const s = await wajibLogin();
  if (!bolehEdit(s.peran)) return { error: TIDAK_BERHAK };
  const db = admin();
  const id = Number(fd.get("id"));
  const nama = text(fd, "nama");
  if (!nama) return { error: "Nama kompetensi wajib diisi." };
  const NAMA_LEVEL = ["Dasar", "Memadai", "Mandiri", "Mahir", "Master"];
  let kode: string;
  try {
    // per level: textarea deskripsi-<n> + daftar indikator-<n> (JSON) dari LevelEditor; level yang kosong dihapus
    const levels = [1, 2, 3, 4, 5].map((level) => ({
      level,
      nama_level: NAMA_LEVEL[level - 1],
      deskripsi: String(fd.get(`deskripsi-${level}`) ?? "").trim() || null,
      indikator: lines(json<string[]>(fd, `indikator-${level}`)),
    }));
    // level yang terisi harus berurutan dari 1: jumlah level dipakai sebagai level tertinggi di pemetaan
    const terisi = levels.filter((l) => l.deskripsi || l.indikator.length).map((l) => l.level);
    if (terisi.some((l, i) => l !== i + 1)) return { error: `Level harus terisi berurutan mulai Level 1 — sekarang terisi: ${terisi.join(", ")}.` };
    const target = ok(await db.from("jabatan_kompetensi").select("level_target").eq("kompetensi_id", id).order("level_target", { ascending: false }).limit(1))[0];
    if (target && target.level_target > terisi.length)
      return { error: `Ada jabatan yang menargetkan Level ${target.level_target} kompetensi ini. Turunkan target di pemetaan dulu sebelum mengosongkan level tersebut.` };
    kode = ok(
      await db.rpc("simpan_kompetensi", {
        p_id: id,
        p_nama: nama,
        p_definisi: text(fd, "definisi") as string, // null = definisi dikosongkan
        p_status: String(fd.get("status") || "lengkap"),
        p_catatan: lines(json<string[]>(fd, "catatan")),
        p_levels: levels,
      }),
    );
  } catch (e) {
    return { error: `Gagal menyimpan kompetensi: ${(e as Error).message}` };
  }
  refreshAll();
  redirect(`/kompetensi/${kode}`);
}

// ---------- penilaian diri

export type HasilPenilaian = { error?: string; level?: number; target?: number | null; disimpan?: string };

/** Simpan penilaian diri pengguna yang login. Level dihitung ulang dari indikator di database, bukan dari browser. */
export async function simpanPenilaianDiri(kode: string, jabatanKode: string | null, dicentang: string[]): Promise<HasilPenilaian> {
  const s = await wajibLogin();
  if (!PENILAIAN_DIRI_AKTIF) return { error: "Penilaian diri sedang dinonaktifkan." };
  const db = admin();
  try {
    const k = ok(
      await db
        .from("kompetensi")
        .select("id, level:kompetensi_level(level, indikator:indikator_perilaku(urutan))")
        .eq("kode", kode)
        .single(),
    );
    const levels = k.level.map((l) => ({ level: l.level, urutan: l.indikator.map((i) => i.urutan) }));
    const sah = new Set(levels.flatMap((l) => l.urutan.map((u) => kunciIndikator(l.level, u))));
    const centang = [...new Set(dicentang)].filter((c) => sah.has(c)).sort();
    const level = hitungLevel(levels, new Set(centang));

    let jabatanId: number | null = null;
    let target: number | null = null;
    if (jabatanKode) {
      const j = ok(await db.from("jabatan").select("id, jabatan_kompetensi(level_target, kompetensi_id)").eq("kode", jabatanKode).single());
      jabatanId = j.id;
      target = j.jabatan_kompetensi.find((x) => x.kompetensi_id === k.id)?.level_target ?? null;
    }

    const row = ok(
      await db
        .from("penilaian_diri")
        .upsert(
          { pengguna_id: s.id, kompetensi_id: k.id, jabatan_id: jabatanId, dicentang: centang, level_perkiraan: level, level_target: target, updated_at: now() },
          { onConflict: "pengguna_id,kompetensi_id" },
        )
        .select("updated_at")
        .single(),
    );
    revalidatePath("/penilaian-diri");
    return { level, target, disimpan: row.updated_at };
  } catch (e) {
    return { error: `Gagal menyimpan penilaian: ${(e as Error).message}` };
  }
}

export async function hapusPenilaianDiri(kode: string): Promise<HasilPenilaian> {
  const s = await wajibLogin();
  if (!PENILAIAN_DIRI_AKTIF) return { error: "Penilaian diri sedang dinonaktifkan." };
  const db = admin();
  try {
    const k = ok(await db.from("kompetensi").select("id").eq("kode", kode).single());
    ok(await db.from("penilaian_diri").delete().eq("pengguna_id", s.id).eq("kompetensi_id", k.id).select("id"));
    revalidatePath("/penilaian-diri");
    return {};
  } catch (e) {
    return { error: `Gagal menghapus penilaian: ${(e as Error).message}` };
  }
}

"use client";

import Link from "next/link";
import { isValidElement, useDeferredValue, useEffect, useState } from "react";
import { LEVEL_NAMA } from "@/lib/labels";
import { MENU } from "@/lib/menu";
import { PERAN, PERAN_LABEL, PERAN_PENJELASAN, bolehEdit, bolehKelolaAkun, type Peran } from "@/lib/peran";

// Isi panduan per menu. `peran` menandai bagian yang hanya bisa dipakai peran tertentu.
type Bagian = {
  id: string;
  judul: string;
  grup: (typeof GRUP)[number];
  icon: string;
  href?: string;
  peran?: "editor" | "admin";
  ringkas: string;
  langkah?: React.ReactNode[];
  isi?: React.ReactNode;
};

const GRUP = ["Memulai", "Menjelajah data", "Pemetaan & review", "Akun"] as const;

const ikonMenu = (href: string) => MENU.find((m) => m.href === href)?.icon ?? "";
const IKON = {
  mulai: "M10 3v4M10 13v4M3 10h4M13 10h4M10 10l4.5-4.5",
  edit: "M12.5 4.5l3 3L7 16H4v-3zM11 6l3 3",
  akun: "M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5",
  admin: "M10 2.5l1.6 2.2 2.7-.4.4 2.7 2.2 1.6-1.4 2.4 1.4 2.4-2.2 1.6-.4 2.7-2.7-.4L10 17.5l-1.6-2.2-2.7.4-.4-2.7-2.2-1.6L4.5 10 3.1 7.6l2.2-1.6.4-2.7 2.7.4zM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  tip: "M7.5 15.5h5M8 17.5h4M10 2.5a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z",
  cari: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5 17 17",
  manfaat: "M10 2.5l2.3 4.7 5.2.8-3.8 3.6.9 5.1L10 14.3l-4.6 2.4.9-5.1L2.5 8l5.2-.8z",
};

const BAGIAN: Bagian[] = [
  {
    id: "manfaat",
    judul: "Manfaat aplikasi",
    grup: "Memulai",
    icon: IKON.manfaat,
    ringkas: "Untuk apa Kamus Kompetensi dipakai dan apa untungnya bagi Anda.",
    isi: (
      <>
        <p>
          Kamus Kompetensi menjadi satu acuan bersama tentang kompetensi apa yang dibutuhkan setiap jabatan di Bank Sultra, sampai level berapa,
          dan seperti apa perilaku yang diharapkan di setiap level.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Kotak judul="Satu bahasa kompetensi">
            Definisi dan indikator perilaku yang sama dipakai seluruh unit, sehingga tidak ada lagi tafsir berbeda tentang arti suatu kompetensi.
          </Kotak>
          <Kotak judul="Rekrutmen & seleksi">
            Level target per jabatan menjadi dasar kriteria seleksi dan pertanyaan wawancara berbasis perilaku.
          </Kotak>
          <Kotak judul="Pelatihan tepat sasaran">
            Kesenjangan level antara jabatan saat ini dan jabatan tujuan menunjukkan kompetensi mana yang perlu dikembangkan lebih dulu.
          </Kotak>
          <Kotak judul="Promosi, rotasi & suksesi">
            Kedekatan profil antarjabatan membantu menemukan calon penerus dan pilihan rotasi yang masuk akal, bukan sekadar berdasarkan senioritas.
          </Kotak>
          <Kotak judul="Penilaian yang objektif">
            Indikator per level memberi tolok ukur yang jelas saat atasan menilai bawahan dan memberi umpan balik.
          </Kotak>
          <Kotak judul="Dokumen siap pakai">
            Kamus, uraian tugas, dan matriks kompetensi bisa diunduh sebagai PDF atau CSV tanpa perlu menyusun ulang.
          </Kotak>
        </div>
        <Tip>
          Ingin tahu apa yang perlu diasah untuk jabatan berikutnya? Buka <b>Jalur Karier</b>, pilih jabatan Anda sekarang dan jabatan yang dituju,
          lalu lihat peta kesenjangan levelnya.
        </Tip>
      </>
    ),
  },
  {
    id: "mulai",
    judul: "Masuk & navigasi",
    grup: "Memulai",
    icon: IKON.mulai,
    ringkas: "Login, sidebar, dan tempat menemukan akun Anda.",
    langkah: [
      <>Masuk dengan username dan password dari admin.</>,
      <>
        Centang <b>Ingat saya selama 30 hari</b> hanya di perangkat pribadi.
      </>,
      <>Pilih menu di sidebar kiri; tombol di samping logo menciutkannya menjadi ikon saja.</>,
      <>
        Di bawah sidebar ada tautan <b>Akun saya</b>, nama dan peran Anda, serta tombol keluar.
      </>,
    ],
    isi: <Tip>Setelah beberapa kali salah password, akun terkunci sementara. Tunggu beberapa menit atau minta admin mereset password.</Tip>,
  },
  {
    id: "ringkasan",
    judul: "Ringkasan",
    grup: "Menjelajah data",
    icon: ikonMenu("/"),
    href: "/",
    ringkas: "Gambaran besar kamus, jabatan, dan pekerjaan yang masih tertunda.",
    isi: (
      <p>
        Halaman awal berisi jumlah kompetensi per kategori dan bidang, sebaran level, jumlah jabatan, progres review, serta daftar pekerjaan yang
        masih tertunda. Klik kartu atau baris mana pun untuk langsung membuka halaman terkait.
      </p>
    ),
  },
  {
    id: "kompetensi",
    judul: "Kamus Kompetensi",
    grup: "Menjelajah data",
    icon: ikonMenu("/kompetensi"),
    href: "/kompetensi",
    ringkas: "Definisi, lima level, dan indikator perilaku setiap kompetensi.",
    langkah: [
      <>Ketik nama, kode, atau isi definisi di kotak pencarian, atau saring dengan tombol bidang.</>,
      <>Klik kompetensi untuk membuka detailnya.</>,
      <>
        Pilih tampilan <b>Per level</b>, <b>Bandingkan</b> dua level, atau <b>Semua level</b>.
      </>,
      <>
        Unduh satu kompetensi lewat tombol <b>PDF</b>, atau seluruh kamus lewat <b>Seluruh kamus (PDF)</b> di halaman daftar.
      </>,
    ],
    isi: <TanggaLevel />,
  },
  {
    id: "jabatan",
    judul: "Daftar Jabatan",
    grup: "Menjelajah data",
    icon: ikonMenu("/jabatan"),
    href: "/jabatan",
    ringkas: "Jabatan per direktorat dan divisi/kantor, lengkap dengan jobdesk dan kompetensinya.",
    langkah: [
      <>Saring dengan nama jabatan atau unit, kelompok jabatan, kelengkapan, dan status review.</>,
      <>
        Klik <b>Terapkan</b>, lalu buka jabatan yang dicari.
      </>,
      <>Detail jabatan menampilkan posisi dalam struktur, jobdesk, dan kompetensi beserta level targetnya.</>,
      <>Unduh uraian tugas lewat tombol PDF.</>,
    ],
    isi: (
      <Tip>
        Label <b>Usulan otomatis</b> berarti pemetaan masih draf dari sistem dan belum ditinjau. Alamat halaman menyimpan filter, jadi tautannya bisa
        disalin dan dibagikan.
      </Tip>
    ),
  },
  {
    id: "matriks",
    judul: "Matriks Kompetensi",
    grup: "Menjelajah data",
    icon: ikonMenu("/matriks"),
    href: "/matriks",
    ringkas: "Jabatan × kompetensi dalam satu tabel, siap dibuka di Excel.",
    langkah: [
      <>Pilih divisi/kantor dan kategori, atau cari jabatan.</>,
      <>
        Klik <b>Tampilkan</b>. Angka di sel adalah level target; makin gelap warnanya, makin tinggi levelnya.
      </>,
      <>
        Unduh <b>Tampilan ini (CSV)</b> atau <b>Semua jabatan (CSV)</b> untuk diolah di Excel.
      </>,
    ],
  },
  {
    id: "karier",
    judul: "Jalur Karier",
    grup: "Menjelajah data",
    icon: ikonMenu("/karier"),
    href: "/karier",
    ringkas: "Kedekatan profil antarjabatan untuk promosi, rotasi, dan suksesi.",
    isi: (
      <>
        <p>
          Tanpa pilihan, halaman ini menampilkan <b>peta mobilitas</b>: pasangan rotasi paling alami, lompatan promosi ke atasan langsung, dan
          jabatan spesialis yang sulit diisi lewat rotasi.
        </p>
        <p>
          Pilih jabatan asal (dan jabatan tujuan bila perlu), lalu klik <b>Tampilkan</b> untuk melihat pilihan promosi, rotasi, calon penerus,
          peta kesenjangan level, dan fokus pengembangan.
        </p>
      </>
    ),
  },
  {
    id: "kompetensi-edit",
    judul: "Mengedit kompetensi",
    grup: "Pemetaan & review",
    icon: IKON.edit,
    peran: "editor",
    ringkas: "Memperbarui definisi, status, dan indikator perilaku.",
    langkah: [
      <>
        Buka detail kompetensi, klik <b>Edit kompetensi</b>.
      </>,
      <>Ubah nama, status, definisi, catatan review, dan indikator perilaku per level.</>,
      <>
        Klik <b>Simpan kompetensi</b>.
      </>,
    ],
    isi: (
      <Tip>
        Hanya kompetensi berstatus <b>Lengkap</b> yang bisa dipetakan ke jabatan.
      </Tip>
    ),
  },
  {
    id: "jabatan-edit",
    judul: "Mengedit jabatan & pemetaan",
    grup: "Pemetaan & review",
    icon: IKON.edit,
    peran: "editor",
    ringkas: "Data jabatan, jobdesk, dan kompetensi yang dibutuhkan.",
    isi: (
      <>
        <p>
          Klik <b>+ Tambah jabatan</b> di Daftar Jabatan, atau <b>Edit jabatan, jobdesk &amp; kompetensi</b> di detail jabatan. Halaman edit terdiri
          atas empat kartu yang disimpan masing-masing:
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Kotak judul="Data jabatan">Nama, unit kerja, atasan langsung, kelompok jabatan, jenjang, dan catatan.</Kotak>
          <Kotak judul="Jobdesk">Pangkat, pendidikan, bawahan, fungsi, dan uraian tugas.</Kotak>
          <Kotak judul="Kompetensi yang dibutuhkan">
            Tambah atau hapus kompetensi dan tentukan level target. Menyimpan usulan otomatis mengubahnya menjadi hasil tinjauan.
          </Kotak>
          <Kotak judul="Hapus jabatan" bahaya>
            Menghapus jabatan secara permanen. Gunakan dengan hati-hati.
          </Kotak>
        </div>
      </>
    ),
  },
  {
    id: "review",
    judul: "Progres Review",
    grup: "Pemetaan & review",
    icon: ikonMenu("/review"),
    href: "/review",
    ringkas: "Memantau dan menandai jabatan yang pemetaannya sudah tuntas.",
    isi: (
      <>
        <AlurReview />
        <p>
          Halaman ini menampilkan progres per jenjang dan per divisi/kantor, antrean tindakan, serta aktivitas terbaru. Direksi tidak termasuk.
        </p>
        <p>
          <span className="font-semibold text-slate-900">Editor &amp; Admin:</span> tandai satu jabatan lewat kartu <b>Status review</b> di detail
          jabatan (isi catatan bila perlu), atau pakai <b>Tandai Selesai Massal</b> untuk banyak jabatan sekaligus. Jabatan Selesai bisa dibuka
          kembali ke Draf, dan setiap perubahan tercatat di riwayat jabatan.
        </p>
      </>
    ),
  },
  {
    id: "kualitas",
    judul: "Kualitas Pemetaan",
    grup: "Pemetaan & review",
    icon: ikonMenu("/kualitas"),
    href: "/kualitas",
    ringkas: "Daftar periksa sebelum menandai jabatan selesai.",
    isi: (
      <p>
        Cek cakupan kamus dan konsistensi pemetaan: kompetensi teknis yang belum dipakai, kompetensi yang belum final, level bawahan yang
        melebihi atasan, dan uraian tugas tanpa kompetensi.
      </p>
    ),
  },
  {
    id: "analisa",
    judul: "Analisa Data",
    grup: "Pemetaan & review",
    icon: ikonMenu("/analisa"),
    href: "/analisa",
    ringkas: "Membaca isi kamus dari sisi kedalaman dan tumpang tindih.",
    isi: (
      <p>
        Kedalaman indikator, tumpang tindih antarbidang, sebaran level target per jenjang, dan kesesuaian saran bidang awal dengan hasil
        pemetaan.
      </p>
    ),
  },
  {
    id: "akun",
    judul: "Akun saya",
    grup: "Akun",
    icon: IKON.akun,
    href: "/akun",
    ringkas: "Melihat peran dan mengganti password.",
    langkah: [
      <>
        Klik <b>Akun saya</b> di bawah sidebar.
      </>,
      <>Isi password saat ini, password baru, dan ulangi password baru.</>,
      <>
        Klik <b>Ganti password</b>.
      </>,
    ],
  },
  {
    id: "admin",
    judul: "Admin",
    grup: "Akun",
    icon: IKON.admin,
    href: "/admin/pengguna",
    peran: "admin",
    ringkas: "Mengelola akun pengguna dan pengaturan aplikasi.",
    isi: (
      <div className="grid gap-2 sm:grid-cols-2">
        <Kotak judul="Pengguna">
          Buat akun (username huruf kecil, angka, titik, minus, atau garis bawah), ubah nama dan peran, nonaktifkan akun dengan menghapus centang
          Aktif, atau reset password.
        </Kotak>
        <Kotak judul="Pengaturan">
          Teks edisi data di sidebar, serta keamanan login: batas gagal login, lama akun terkunci, lama sesi, lama &ldquo;Ingat saya&rdquo;, dan
          panjang password minimal.
        </Kotak>
      </div>
    ),
  },
];

const TANYA: { t: string; j: React.ReactNode }[] = [
  {
    t: "Saya lupa password. Apa yang harus dilakukan?",
    j: (
      <>
        Hubungi admin untuk mereset password, lalu segera ganti di <b>Akun saya</b>.
      </>
    ),
  },
  { t: "Akun saya terkunci.", j: <>Akun terkunci sementara setelah beberapa kali salah password. Tunggu beberapa menit, atau minta admin mereset password.</> },
  {
    t: "Kenapa tombol Edit tidak muncul?",
    j: (
      <>
        Tombol edit hanya tampil untuk peran <b>Editor</b> dan <b>Admin</b>. Peran Pembaca hanya dapat melihat dan mengunduh.
      </>
    ),
  },
  {
    t: "Kompetensi tidak muncul saat memetakan jabatan.",
    j: (
      <>
        Hanya kompetensi berstatus <b>Lengkap</b> yang bisa dipetakan. Ubah statusnya di halaman edit kompetensi.
      </>
    ),
  },
  { t: "File CSV matriks terbuka berantakan di Excel?", j: <>File memakai pemisah titik koma (;) sesuai Excel berbahasa Indonesia. Buka langsung dengan klik ganda, bukan lewat impor teks.</> },
];

// teks polos dari JSX statis, untuk pencarian
function teks(n: React.ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(teks).join(" ");
  if (isValidElement<{ children?: React.ReactNode; judul?: string }>(n)) return `${n.props.judul ?? ""} ${teks(n.props.children)}`;
  return "";
}
const rata = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
const CARI_BAGIAN = BAGIAN.map((b) => rata([b.judul, b.ringkas, teks(b.langkah), teks(b.isi)].join(" ")));
const CARI_TANYA = TANYA.map((q) => rata(`${q.t} ${teks(q.j)}`));

const berhak = (syarat: Bagian["peran"], p: Peran | null) => !syarat || !p || (syarat === "admin" ? bolehKelolaAkun(p) : bolehEdit(p));

export function Panduan({ peran }: { peran: Peran | null }) {
  const [q, setQ] = useState("");
  const cari = rata(useDeferredValue(q).trim());
  const [aktif, setAktif] = useState(BAGIAN[0].id);

  const tampil = BAGIAN.filter((_, i) => !cari || CARI_BAGIAN[i].includes(cari));
  const tanya = TANYA.filter((_, i) => !cari || CARI_TANYA[i].includes(cari));

  // sorot entri daftar isi untuk bagian yang sedang terbaca
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => {
        const atas = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (atas) setAktif(atas.target.id);
      },
      { rootMargin: "0px 0px -65% 0px" },
    );
    document.querySelectorAll("[data-bagian]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [cari]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-brand-950 p-6 text-white shadow-lg ring-1 ring-brand-900 md:p-8">
        {/* cahaya dekoratif */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 size-80 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-end">
          <div className="animate-[masuk_0.4s_ease-out_both]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Panduan Pengguna</div>
            <h1 className="mt-2 font-heading text-[28px] font-semibold leading-tight tracking-tight md:text-[34px]">
              Semua yang perlu Anda tahu untuk memakai Kamus Kompetensi
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-brand-200">
              {BAGIAN.length} topik, dari mencari kompetensi sampai menandai pemetaan jabatan selesai. Bagian berlabel peran hanya bisa dipakai akun
              dengan peran tersebut.
            </p>
            <label className="relative mt-6 block max-w-xl">
              <span className="sr-only">Cari di panduan</span>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-brand-300" aria-hidden>
                <path d={IKON.cari} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari di panduan, mis. password, PDF, level target…"
                className="h-12 w-full rounded-xl bg-white/10 pl-11 pr-4 text-[15px] text-white ring-1 ring-white/15 placeholder:text-brand-300 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </label>
          </div>
          <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { href: "/kompetensi", judul: "Cari kompetensi", ket: "Definisi dan 5 level perilaku" },
              { href: "/jabatan", judul: "Buka jabatan", ket: "Jobdesk dan level target" },
              { href: "/matriks", judul: "Unduh dokumen", ket: "PDF kamus, jobdesk, CSV matriks" },
            ].map((s, i) => (
              <li key={s.href} className="animate-[masuk_0.4s_ease-out_both]" style={{ animationDelay: `${120 + i * 80}ms` }}>
                <Link href={s.href} className="group flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-white/20">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-400 font-heading text-sm font-semibold text-brand-950">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{s.judul}</span>
                    <span className="block truncate text-xs text-brand-200">{s.ket}</span>
                  </span>
                  <span className="text-brand-300 transition group-hover:translate-x-0.5 group-hover:text-white" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="judul-peran">
        <h2 id="judul-peran" className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-700">
          Peran akun
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {PERAN.map((p) => {
            const saya = p === peran;
            return (
              <div
                key={p}
                className={`relative rounded-xl border bg-white p-4 shadow-sm ${saya ? "border-brand-300 ring-2 ring-brand-500/20" : "border-slate-200"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-heading text-base font-semibold text-slate-900">{PERAN_LABEL[p]}</div>
                  {saya && <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-semibold text-white">Peran Anda</span>}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{PERAN_PENJELASAN[p]}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Daftar isi" className="hidden lg:sticky lg:top-8 lg:block lg:self-start">
          {GRUP.map((g) => {
            const isi = tampil.filter((b) => b.grup === g);
            if (!isi.length) return null;
            return (
              <div key={g} className="mb-5">
                <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{g}</div>
                <ul className="space-y-0.5 border-l border-slate-200">
                  {isi.map((b) => (
                    <li key={b.id}>
                      <a
                        href={`#${b.id}`}
                        aria-current={aktif === b.id ? "location" : undefined}
                        className={`-ml-px block border-l-2 py-1 pl-3 text-sm transition-colors ${
                          aktif === b.id ? "border-amber-400 font-semibold text-brand-800" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                        }`}
                      >
                        {b.judul}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {tanya.length > 0 && (
            <a href="#tanya" className="block px-3 text-sm font-medium text-slate-600 hover:text-slate-900">
              Pertanyaan umum →
            </a>
          )}
        </nav>

        <div className="min-w-0 max-w-4xl space-y-10">
          {!tampil.length && !tanya.length && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              Tidak ada topik yang cocok dengan &ldquo;{q}&rdquo;.{" "}
              <button type="button" onClick={() => setQ("")} className="link">
                Hapus pencarian
              </button>
            </div>
          )}
          {GRUP.map((g) => {
            const isi = tampil.filter((b) => b.grup === g);
            if (!isi.length) return null;
            return (
              <div key={g} className="space-y-4">
                <h2 className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-wide text-slate-700">
                  {g}
                  <span className="h-px flex-1 bg-slate-200" aria-hidden />
                </h2>
                {isi.map((b) => (
                  <KartuBagian key={b.id} b={b} peran={peran} />
                ))}
              </div>
            );
          })}

          {tanya.length > 0 && (
            <section id="tanya" className="scroll-mt-6 space-y-4">
              <h2 className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-wide text-slate-700">
                Pertanyaan umum
                <span className="h-px flex-1 bg-slate-200" aria-hidden />
              </h2>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {tanya.map((x) => (
                  <details key={x.t} className="group" open={!!cari}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-[15px] font-medium text-slate-900 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                      {x.t}
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition group-open:rotate-45" aria-hidden>
                        +
                      </span>
                    </summary>
                    <p className="px-5 pb-4 text-[15px] leading-relaxed text-slate-600">{x.j}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function KartuBagian({ b, peran }: { b: Bagian; peran: Peran | null }) {
  const boleh = berhak(b.peran, peran);
  return (
    <section
      id={b.id}
      data-bagian
      className={`scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${boleh ? "" : "opacity-70"}`}
    >
      <header className="flex flex-wrap items-start gap-4 border-b border-slate-100 p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-5" aria-hidden>
            <path d={b.icon} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-semibold text-slate-900">{b.judul}</h3>
            {b.peran &&
              (boleh ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                  {b.peran === "admin" ? "Admin" : "Editor & Admin"}
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-300">
                  Tidak tersedia untuk peran Anda
                </span>
              ))}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">{b.ringkas}</p>
        </div>
        {b.href && boleh && (
          <Link href={b.href} className="btn-secondary h-9 shrink-0 text-[13px]">
            Buka halaman →
          </Link>
        )}
      </header>
      <div className="space-y-4 p-5 text-[15px] leading-relaxed text-slate-700">
        {b.langkah && (
          <ol className="space-y-2.5">
            {b.langkah.map((l, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-semibold tabular-nums text-white">{i + 1}</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        )}
        {b.isi}
      </div>
    </section>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden>
        <path d={IKON.tip} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p>{children}</p>
    </div>
  );
}

function Kotak({ judul, bahaya, children }: { judul: string; bahaya?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg p-3 ring-1 ${bahaya ? "bg-rose-50/60 ring-rose-200" : "bg-slate-50 ring-slate-200"}`}>
      <div className={`text-sm font-semibold ${bahaya ? "text-rose-800" : "text-slate-900"}`}>{judul}</div>
      <p className="mt-0.5 text-sm text-slate-600">{children}</p>
    </div>
  );
}

// lima level kompetensi, warnanya sama dengan sel heatmap Matriks (.lv1–.lv5)
function TanggaLevel() {
  return (
    <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Lima level kompetensi</div>
      <div className="grid grid-cols-5 items-end gap-2" role="img" aria-label={`Level 1 sampai 5: ${LEVEL_NAMA.join(", ")}`}>
        {LEVEL_NAMA.map((n, i) => (
          <div key={n} className="text-center">
            <div
              className={`lv${i + 1} grid origin-bottom animate-[naik_0.6s_ease-out_both] place-items-center rounded-md font-heading text-sm font-semibold`}
              style={{ height: `${28 + i * 12}px`, animationDelay: `${i * 70}ms` }}
            >
              {i + 1}
            </div>
            <div className="mt-1.5 truncate text-xs font-medium text-slate-600">{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlurReview() {
  const tahap = [
    { label: "Draf", ket: "dikerjakan konsultan", kelas: "bg-slate-100 text-slate-700 ring-slate-300" },
    { label: "Selesai", ket: "ditandai editor/admin", kelas: "bg-emerald-50 text-emerald-800 ring-emerald-300" },
    { label: "Divisi HC", ket: "menerima hasil", kelas: "bg-brand-50 text-brand-800 ring-brand-200" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tahap.map((t, i) => (
        <div key={t.label} className="flex items-center gap-2">
          {i > 0 && (
            <span className="text-slate-400" aria-hidden>
              →
            </span>
          )}
          <div className={`rounded-lg px-3 py-1.5 ring-1 ring-inset ${t.kelas}`}>
            <div className="text-sm font-semibold">{t.label}</div>
            <div className="text-[11px] opacity-80">{t.ket}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

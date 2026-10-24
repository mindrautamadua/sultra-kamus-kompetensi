import "server-only";
import path from "node:path";
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { JENJANG_LABEL } from "@/lib/labels";
import type { LaporanData } from "./laporan-data";
import "./font";

// Laporan Eksekutif untuk Direksi: A4 landscape bergaya deck konsultan. Setiap halaman satu pesan:
// judul berupa kesimpulan ("action title"), bukti berupa grafik/angka, dan baris sumber data.
// Karakter di luar subset latin font (mis. panah, ≥) dihindari.

const LOGO = path.join(process.cwd(), "public/brand/logo-bank-sultra.png");
const LOGO_PUTIH = path.join(process.cwd(), "public/brand/logo-bank-sultra-putih.png");
const W = 841.89;
const H = 595.28;
const TEPI = 40;
const TARGET_MINGGU = 8; // horizon rekomendasi laju review

const C = {
  navy: "#121a42",
  brand: "#1f37b4",
  brandSedang: "#6087f6",
  brandMuda: "#bfd0fd",
  brandLatar: "#eef3ff",
  amber: "#f59e0b",
  amberMuda: "#fffbeb",
  teks: "#1e293b",
  redup: "#64748b",
  garis: "#e2e8f0",
  latar: "#f8fafc",
  hijau: "#059669",
  hijauMuda: "#ecfdf5",
  merah: "#b91c1c",
};
const LEVEL_WARNA = ["#eef3ff", "#dbe5fe", "#93b0fb", "#2747d9", "#1d2d73"];
const LEVEL_TEKS = ["#1e3192", "#1d2d73", "#121a42", "#fff", "#fff"];
const LEVEL_NAMA = ["Dasar", "Memadai", "Mandiri", "Mahir", "Master"];

const BAB = ["Ringkasan", "Kamus", "Jabatan", "Pemetaan", "Kualitas", "Review", "Rekomendasi"] as const;
type Bab = (typeof BAB)[number] | "Lampiran";

const des = (n: number, d = 1) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (n: number) => n.toLocaleString("id-ID");
const persen = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const tanggal = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Makassar" });

const s = StyleSheet.create({
  page: { fontFamily: "Albert Sans", fontSize: 9, lineHeight: 1.35, color: C.teks, paddingTop: 62, paddingBottom: 44, paddingHorizontal: TEPI },
  pelacak: { position: "absolute", top: 22, left: TEPI, flexDirection: "row" },
  kaki: { position: "absolute", top: H - 28, left: TEPI, right: TEPI, fontSize: 6.5, color: C.redup },
  judul: { fontSize: 17, fontWeight: "bold", color: C.navy, lineHeight: 1.2 },
  sub: { fontSize: 9, color: C.redup, marginTop: 4 },
  label: { fontSize: 6.5, fontWeight: "bold", letterSpacing: 0.9, color: C.redup },
  kartu: { borderWidth: 0.75, borderColor: C.garis, borderRadius: 5, padding: 12 },
  kartuJudul: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 0.9, color: C.brand, marginBottom: 8 },
  angka: { fontSize: 22, fontWeight: "bold", color: C.navy, lineHeight: 1.05 },
  chip: { fontSize: 6.5, fontWeight: "bold", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
});

/** Kerangka satu halaman: pelacak bab, logo, judul-kesimpulan, isi, baris sumber dan nomor halaman. */
function Slide({
  bab,
  judul,
  sub,
  sumber,
  edisi,
  implikasi,
  children,
}: {
  bab: Bab;
  judul: string;
  sub?: string;
  sumber: string;
  edisi: string;
  /** pesan "jadi apa artinya" di dasar halaman */
  implikasi?: string;
  children: React.ReactNode;
}) {
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={s.pelacak} fixed>
        {BAB.map((b, i) => (
          <View key={b} style={{ marginRight: 14, paddingBottom: 3, borderBottomWidth: 1.5, borderColor: b === bab ? C.amber : "transparent" }}>
            <Text style={{ fontSize: 6.5, fontWeight: b === bab ? "bold" : "normal", color: b === bab ? C.navy : "#94a3b8", letterSpacing: 0.6 }}>
              {String(i + 1).padStart(2, "0")} {b.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> */}
      <Image src={LOGO} style={{ position: "absolute", top: 16, right: TEPI, height: 20 }} fixed />
      <View style={{ width: 36, height: 2.5, backgroundColor: C.amber, marginBottom: 8 }} />
      <Text style={s.judul}>{judul}</Text>
      {sub && <Text style={s.sub}>{sub}</Text>}
      <View style={{ flex: 1, marginTop: 16 }}>{children}</View>
      {implikasi && (
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.navy, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 14, marginTop: 12 }} wrap={false}>
          <Text style={{ fontSize: 7, fontWeight: "bold", letterSpacing: 1, color: C.amber, width: 74 }}>IMPLIKASI</Text>
          <Text style={{ flex: 1, fontSize: 9.5, color: "#fff" }}>{implikasi}</Text>
        </View>
      )}
      <Text style={[s.kaki, { right: 260 }]} fixed>
        Sumber: {sumber}
      </Text>
      <Text style={[s.kaki, { left: W - TEPI - 250, textAlign: "right" }]} fixed render={({ pageNumber }) => `Laporan Eksekutif Kamus Kompetensi · ${edisi} · ${pageNumber}`} />
    </Page>
  );
}

function Kolom({ children, gap = 14 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ flexDirection: "row", alignItems: "flex-start", marginRight: -gap }}>{children}</View>;
}

function Ubin({ label, nilai, ket, warna = C.brand }: { label: string; nilai: string; ket?: string; warna?: string }) {
  return (
    <View style={[s.kartu, { borderTopWidth: 2.5, borderTopColor: warna, marginBottom: 8 }]}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.angka, { marginTop: 3 }]}>{nilai}</Text>
      {ket && <Text style={{ fontSize: 7.5, color: C.redup, marginTop: 3 }}>{ket}</Text>}
    </View>
  );
}

/** Batang horizontal: panjang = n/maks; `bagian` (opsional) = porsi yang disorot dengan warna lebih tua. */
function BarisBatang({ label, n, maks, bagian, nilai, warna = C.brandMuda, warnaBagian = C.brand, lebarLabel = 150 }: {
  label: string;
  n: number;
  maks: number;
  bagian?: number;
  nilai: string;
  warna?: string;
  warnaBagian?: string;
  lebarLabel?: number;
}) {
  const lebar = maks ? (n / maks) * 100 : 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6.5 }} wrap={false}>
      {lebarLabel > 0 && <Text style={{ width: lebarLabel, fontSize: 8, paddingRight: 6 }}>{label}</Text>}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: `${lebar}%`, height: 11, backgroundColor: warna, borderRadius: 1.5, flexDirection: "row" }}>
          {bagian !== undefined && n > 0 && <View style={{ width: `${(bagian / n) * 100}%`, height: 11, backgroundColor: warnaBagian, borderRadius: 1.5 }} />}
        </View>
        <Text style={{ fontSize: 8, marginLeft: 5, color: C.teks }}>{nilai}</Text>
      </View>
    </View>
  );
}

function Legenda({ items }: { items: [string, string][] }) {
  return (
    <View style={{ flexDirection: "row", marginTop: 6 }}>
      {items.map(([warna, teks]) => (
        <View key={teks} style={{ flexDirection: "row", alignItems: "center", marginRight: 12 }}>
          <View style={{ width: 7, height: 7, borderRadius: 1, backgroundColor: warna, marginRight: 4 }} />
          <Text style={{ fontSize: 7, color: C.redup }}>{teks}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- halaman */

function Sampul({ d, edisi }: { d: LaporanData; edisi: string }) {
  return (
    <Page size="A4" orientation="landscape" style={{ fontFamily: "Albert Sans", backgroundColor: C.navy, color: "#fff", padding: 56 }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> */}
      <Image src={LOGO_PUTIH} style={{ height: 34, alignSelf: "flex-start" }} />
      <View style={{ flex: 1, justifyContent: "center" }}>
        <View style={{ width: 48, height: 3, backgroundColor: C.amber, marginBottom: 14 }} />
        <Text style={{ fontSize: 9, fontWeight: "bold", letterSpacing: 2, color: C.amber }}>LAPORAN EKSEKUTIF</Text>
        <Text style={{ fontSize: 32, fontWeight: "bold", lineHeight: 1.15, marginTop: 8, maxWidth: 560 }}>Kamus & Pemetaan Kompetensi Jabatan</Text>
        <Text style={{ fontSize: 12, color: C.brandMuda, marginTop: 10, maxWidth: 520 }}>
          Status, temuan, dan langkah berikutnya menuju standar kompetensi yang disahkan untuk seluruh jabatan Bank Sultra.
        </Text>
      </View>
      <View style={{ flexDirection: "row", borderTopWidth: 0.75, borderColor: "#ffffff33", paddingTop: 12 }}>
        {[
          ["DISIAPKAN UNTUK", "Direksi PT. Bank Pembangunan Daerah Sulawesi Tenggara"],
          ["EDISI DATA", edisi],
          ["DICETAK", tanggal(d.dicetak)],
        ].map(([k, v]) => (
          <View key={k} style={{ marginRight: 40 }}>
            <Text style={{ fontSize: 6.5, fontWeight: "bold", letterSpacing: 1, color: C.brandMuda }}>{k}</Text>
            <Text style={{ fontSize: 9, marginTop: 2 }}>{v}</Text>
          </View>
        ))}
        <Text style={{ marginLeft: "auto", fontSize: 7, color: C.brandMuda, alignSelf: "flex-end" }}>Rahasia · untuk kalangan terbatas</Text>
      </View>
    </Page>
  );
}

function rekomendasi(d: LaporanData) {
  const r = d.review;
  const perlu = Math.ceil(r.draf / TARGET_MINGGU);
  const temuan = d.kualitas.total - d.kualitas.bersih;
  const out: { aksi: string; dasar: string; pj: string }[] = [];
  if (r.draf)
    out.push({
      aksi: `Tuntaskan review ${fmt(r.draf)} jabatan berstatus draf dalam ${TARGET_MINGGU} minggu`,
      dasar: `Butuh sekitar ${fmt(perlu)} jabatan selesai per minggu; laju 4 minggu terakhir ${des(r.lajuMinggu)} per minggu.`,
      pj: "Konsultan, Divisi HC",
    });
  if (temuan)
    out.push({
      aksi: `Perbaiki temuan kualitas pada ${fmt(temuan)} jabatan sebelum pengesahan`,
      dasar: `${d.kualitas.cek.filter((c) => c.n).length} dari ${d.kualitas.cek.length} cek otomatis masih menemukan masalah (lihat halaman Kualitas).`,
      pj: "Konsultan",
    });
  if (d.pemakaian.tidakDipakai)
    out.push({
      aksi: `Putuskan nasib ${fmt(d.pemakaian.tidakDipakai)} kompetensi teknis yang belum dipakai: petakan, gabungkan, atau pensiunkan`,
      dasar: `${persen(d.pemakaian.tidakDipakai, d.pemakaian.teknis)}% kompetensi teknis lengkap belum dipakai jabatan mana pun.`,
      pj: "Divisi HC, pemilik bidang",
    });
  if (d.kualitas.celah)
    out.push({
      aksi: `Tutup celah kamus untuk ${fmt(d.kualitas.celah)} butir tugas inti tanpa padanan kompetensi`,
      dasar: d.kualitas.celahPerUnit.length ? `Terbanyak di ${d.kualitas.celahPerUnit[0].unit} (${fmt(d.kualitas.celahPerUnit[0].butir)} butir).` : "Tambah kompetensi baru atau perluas definisi yang ada.",
      pj: "Konsultan, Divisi HC",
    });
  if (d.kamus.belumFinal)
    out.push({
      aksi: `Finalisasi ${fmt(d.kamus.belumFinal)} kompetensi yang masih berstatus draft atau usulan`,
      dasar: "Hanya kompetensi berstatus lengkap yang dapat dipetakan ke jabatan.",
      pj: "Konsultan",
    });
  out.push({
    aksi: "Tetapkan Profil Kompetensi Jabatan sebagai acuan rekrutmen, promosi, dan penilaian kinerja",
    dasar: "Profil per jabatan sudah dapat diunduh dari aplikasi; berlaku setelah pemetaan disahkan.",
    pj: "Direksi, Divisi HC",
  });
  return out;
}

function Ringkasan({ d, edisi }: { d: LaporanData; edisi: string }) {
  const r = d.review;
  const final = persen(r.selesai, r.total);
  const pesan = [
    {
      angka: fmt(d.kamus.total),
      judul: "kompetensi dalam kamus",
      teks: `${fmt(d.kamus.bidang.length)} bidang, ${fmt(d.kamus.indikator)} indikator perilaku; ${persen(d.kamus.lengkap, d.kamus.total)}% berstatus lengkap.`,
    },
    {
      angka: fmt(d.jabatan.total),
      judul: "jabatan telah dipetakan",
      teks: `Rata-rata ${des(d.jabatan.perJenjang.reduce((s, j) => s + j.rataKomp * j.n, 0) / Math.max(1, d.jabatan.total))} kompetensi per jabatan, dengan level target per jenjang.`,
    },
    {
      angka: `${persen(d.kualitas.bersih, d.kualitas.total)}%`,
      judul: "jabatan lolos semua cek kualitas",
      teks: `${fmt(d.kualitas.bersih)} dari ${fmt(d.kualitas.total)} jabatan tanpa temuan; sisanya perlu dicek sebelum pengesahan.`,
    },
    {
      angka: `${fmt(r.selesai)}/${fmt(r.total)}`,
      judul: "jabatan berstatus final",
      teks: `${fmt(r.selesai)} dari ${fmt(r.total)} jabatan selesai direview; ${fmt(r.draf)} masih draf.`,
    },
  ];
  return (
    <Slide
      bab="Ringkasan"
      edisi={edisi}
      judul={
        final >= 90
          ? "Kamus dan pemetaan kompetensi hampir tuntas dan siap disahkan sebagai standar jabatan"
          : "Fondasi standar kompetensi sudah terbentuk; tahap kritis berikutnya adalah review dan pengesahan pemetaan"
      }
      sub="Ringkasan eksekutif: posisi saat ini dan keputusan yang dimohonkan dari Direksi."
      sumber="Aplikasi Kamus Kompetensi (kamus, pemetaan jabatan, cek kualitas, riwayat review)."
    >
      <Kolom>
        <View style={{ flex: 1.35, marginRight: 14 }}>
          {pesan.map((p) => (
            <View key={p.judul} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 0.75, borderColor: C.garis, paddingVertical: 10 }}>
              <Text style={[s.angka, { width: 110, color: C.brand }]}>{p.angka}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10.5, fontWeight: "bold", color: C.navy }}>{p.judul}</Text>
                <Text style={{ fontSize: 8.5, color: C.redup, marginTop: 1 }}>{p.teks}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, marginRight: 14 }}>
          <View style={{ backgroundColor: C.amberMuda, borderLeftWidth: 3, borderColor: C.amber, padding: 14 }}>
            <Text style={[s.kartuJudul, { color: "#b45309" }]}>KEPUTUSAN YANG DIMOHONKAN</Text>
            {[
              "Menyetujui kamus kompetensi sebagai standar kompetensi resmi Bank Sultra.",
              `Menetapkan target pengesahan pemetaan seluruh jabatan dalam ${TARGET_MINGGU} minggu.`,
              "Menunjuk Divisi HC sebagai pemilik proses pemeliharaan kamus dan profil jabatan.",
            ].map((t, i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: 8 }}>
                <Text style={{ width: 18, fontSize: 11, fontWeight: "bold", color: C.amber }}>{i + 1}</Text>
                <Text style={{ flex: 1, fontSize: 9.5 }}>{t}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 7.5, color: C.redup, marginTop: 6 }}>Rincian langkah dan penanggung jawab ada di halaman Rekomendasi.</Text>
          </View>
        </View>
      </Kolom>
    </Slide>
  );
}

function Kamus({ d, edisi }: { d: LaporanData; edisi: string }) {
  const teknis = d.kamus.bidang.filter((b) => b.kategori === "teknis").sort((a, b) => b.kompetensi - a.kompetensi);
  const inti = d.kamus.bidang.filter((b) => b.kategori !== "teknis");
  const maks = Math.max(1, ...teknis.map((b) => b.kompetensi));
  return (
    <Slide
      bab="Kamus"
      edisi={edisi}
      judul={`Kamus memuat ${fmt(d.kamus.total)} kompetensi di ${fmt(d.kamus.bidang.length)} bidang, dijabarkan dalam ${fmt(d.kamus.indikator)} indikator perilaku`}
      sub={`Setiap kompetensi memiliki definisi dan lima level (${LEVEL_NAMA.join(", ")}) dengan indikator perilaku yang dapat diamati.`}
      implikasi={
        d.kamus.lengkap / Math.max(1, d.kamus.total) >= 0.95
          ? "Kamus sudah cukup luas dan rinci untuk menjadi standar. Fokus berikutnya adalah memastikan setiap kompetensi benar-benar dipakai, bukan menambah kompetensi baru."
          : `${fmt(d.kamus.total - d.kamus.lengkap)} kompetensi belum lengkap dan belum bisa dipetakan; finalisasinya menjadi syarat pengesahan.`
      }
      sumber="Tabel kompetensi, kompetensi_level, dan indikator_perilaku (statistik per bidang)."
    >
      <Kolom>
        <View style={{ width: 190, marginRight: 14 }}>
          <Ubin label="KOMPETENSI" nilai={fmt(d.kamus.total)} ket={inti.map((b) => `${b.kompetensi} ${b.kode === "CC" ? "inti" : b.kode === "LC" ? "kepemimpinan" : b.nama}`).join(" · ")} />
          <Ubin label="BERSTATUS LENGKAP" nilai={`${persen(d.kamus.lengkap, d.kamus.total)}%`} ket={`${fmt(d.kamus.lengkap)} kompetensi siap dipetakan`} warna={C.hijau} />
          <Ubin label="INDIKATOR PERILAKU" nilai={fmt(d.kamus.indikator)} ket={`rata-rata ${des(d.kamus.indikator / Math.max(1, d.kamus.total))} per kompetensi`} warna={C.navy} />
        </View>
        <View style={[s.kartu, { flex: 1, marginRight: 14 }]}>
          <Text style={s.kartuJudul}>KOMPETENSI TEKNIS PER BIDANG</Text>
          {teknis.map((b) => (
            <BarisBatang key={b.kode} label={`${b.nama} (${b.kode})`} lebarLabel={200} n={b.kompetensi} bagian={b.lengkap} maks={maks} nilai={`${b.kompetensi}`} />
          ))}
          <Legenda items={[[C.brand, "berstatus lengkap"], [C.brandMuda, "draft / usulan"]]} />
        </View>
      </Kolom>
    </Slide>
  );
}

function Jabatan({ d, edisi }: { d: LaporanData; edisi: string }) {
  const j = d.jabatan;
  const pelaksana = j.perJenjang.find((x) => x.jj === 4)?.n ?? 0;
  const struktural = j.total - pelaksana;
  const maksJ = Math.max(1, ...j.perJenjang.map((x) => x.n));
  const maksD = Math.max(1, ...j.perDirektorat.map((x) => x.n));
  return (
    <Slide
      bab="Jabatan"
      edisi={edisi}
      judul={`${persen(pelaksana, j.total)}% dari ${fmt(j.total)} jabatan adalah pelaksana; rasio pejabat struktural terhadap pelaksana 1 : ${des(pelaksana / Math.max(1, struktural))}`}
      sub={`Struktur organisasi Perubahan Ketiga: ${fmt(j.pusat)} jabatan di kantor pusat dan ${fmt(j.total - j.pusat)} di jaringan kantor. Direksi tidak termasuk.`}
      implikasi={`Dengan ${persen(pelaksana, j.total)}% jabatan di level pelaksana, kualitas profil pelaksana paling menentukan dampak standar ini pada rekrutmen dan pengembangan pegawai.`}
      sumber="Tabel jabatan dan unit kerja (bagan struktur organisasi)."
    >
      <Kolom>
        <View style={[s.kartu, { flex: 1, marginRight: 14 }]}>
          <Text style={s.kartuJudul}>JABATAN PER JENJANG</Text>
          {j.perJenjang.map((x) => (
            <BarisBatang key={x.jj} label={JENJANG_LABEL[x.jj]} n={x.n} maks={maksJ} nilai={`${fmt(x.n)} · ${persen(x.n, j.total)}%`} warna={x.jj === 4 ? C.brandSedang : C.brand} lebarLabel={130} />
          ))}
        </View>
        <View style={[s.kartu, { flex: 1.2, marginRight: 14 }]}>
          <Text style={s.kartuJudul}>JABATAN PER DIREKTORAT</Text>
          {j.perDirektorat.map((x) => (
            <BarisBatang key={x.nama} label={x.nama} n={x.n} maks={maksD} nilai={fmt(x.n)} warna={x.nama === "Jaringan kantor" ? C.amber : C.brand} lebarLabel={170} />
          ))}
          <Text style={{ fontSize: 7, color: C.redup, marginTop: 4 }}>Jaringan kantor = kantor cabang, cabang pembantu, dan kantor fungsional.</Text>
        </View>
      </Kolom>
    </Slide>
  );
}

function Pemetaan({ d, edisi }: { d: LaporanData; edisi: string }) {
  const jj = [...d.jabatan.perJenjang].sort((a, b) => b.jj - a.jj); // pelaksana ke kepala divisi
  const naik = jj.every((x, i) => i === 0 || x.rataLevel >= jj[i - 1].rataLevel);
  const awal = jj[0];
  const akhir = jj[jj.length - 1];
  return (
    <Slide
      bab="Pemetaan"
      edisi={edisi}
      judul={
        naik
          ? `Level target naik konsisten seiring jenjang: dari L${des(awal.rataLevel)} pada ${JENJANG_LABEL[awal.jj]} hingga L${des(akhir.rataLevel)} pada ${JENJANG_LABEL[akhir.jj]}`
          : "Level target belum naik konsisten antarjenjang dan perlu diselaraskan sebelum pengesahan"
      }
      sub="Setiap jabatan dipetakan ke kompetensi inti, kepemimpinan (struktural), dan teknis, masing-masing dengan level target 1 sampai 5."
      implikasi={
        naik
          ? "Gradasi level antarjenjang sudah logis, sehingga profil dapat langsung dipakai sebagai dasar jalur karier, promosi, dan analisis kesenjangan."
          : "Jenjang yang lebih tinggi semestinya menuntut level lebih tinggi; ketidakkonsistenan ini perlu dibereskan agar jalur karier dapat dipertanggungjawabkan."
      }
      sumber="Pemetaan jabatan_kompetensi (level target per jabatan), dikelompokkan per jenjang."
    >
      <View style={s.kartu}>
        <View style={{ flexDirection: "row", paddingBottom: 6, borderBottomWidth: 0.75, borderColor: C.garis, marginBottom: 8 }}>
          <Text style={[s.label, { width: 150 }]}>JENJANG</Text>
          <Text style={[s.label, { flex: 1 }]}>SEBARAN LEVEL TARGET (PORSI PEMETAAN)</Text>
          <Text style={[s.label, { width: 100, textAlign: "right" }]}>JUMLAH KOMPETENSI</Text>
          <Text style={[s.label, { width: 90, textAlign: "right" }]}>LEVEL RATA-RATA</Text>
        </View>
        {jj.map((x) => {
          const total = x.sebaran.reduce((a, b) => a + b, 0);
          return (
            <View key={x.jj} style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
              <View style={{ width: 150 }}>
                <Text style={{ fontWeight: "bold", color: C.navy }}>{JENJANG_LABEL[x.jj]}</Text>
                <Text style={{ fontSize: 7, color: C.redup }}>{fmt(x.n)} jabatan</Text>
              </View>
              <View style={{ flex: 1, flexDirection: "row", height: 28, borderRadius: 2, overflow: "hidden" }}>
                {x.sebaran.map((n, i) =>
                  n > 0 ? (
                    <View key={i} style={{ flex: n, backgroundColor: LEVEL_WARNA[i], justifyContent: "center", alignItems: "center" }}>
                      {persen(n, total) >= 6 && <Text style={{ fontSize: 7, fontWeight: "bold", color: LEVEL_TEKS[i] }}>{persen(n, total)}%</Text>}
                    </View>
                  ) : null,
                )}
              </View>
              <Text style={{ width: 100, textAlign: "right", fontSize: 13, fontWeight: "bold", color: C.navy }}>{des(x.rataKomp)}</Text>
              <Text style={{ width: 90, textAlign: "right", fontSize: 13, fontWeight: "bold", color: C.brand }}>L{des(x.rataLevel)}</Text>
            </View>
          );
        })}
        <Legenda items={LEVEL_NAMA.map((n, i) => [LEVEL_WARNA[i] === "#eef3ff" ? "#c7d2fe" : LEVEL_WARNA[i], `L${i + 1} ${n}`] as [string, string])} />
      </View>
    </Slide>
  );
}

function Pemakaian({ d, edisi }: { d: LaporanData; edisi: string }) {
  const p = d.pemakaian;
  const teknis = d.kamus.bidang.filter((b) => b.kategori === "teknis").sort((a, b) => b.kompetensi - b.dipakai - (a.kompetensi - a.dipakai));
  const maks = Math.max(1, ...teknis.map((b) => b.kompetensi));
  const maksTop = Math.max(1, ...p.terpopuler.map((x) => x.n));
  return (
    <Slide
      bab="Pemetaan"
      edisi={edisi}
      judul={`${persen(p.teknis - p.tidakDipakai, p.teknis)}% kompetensi teknis sudah dipakai jabatan; ${fmt(p.tidakDipakai)} kompetensi belum dipakai sama sekali`}
      sub="Kompetensi yang tidak dipakai jabatan mana pun menandakan kamus lebih luas dari kebutuhan, atau jabatan yang semestinya memakainya belum terpetakan."
      implikasi={
        p.tidakDipakai
          ? `${fmt(p.tidakDipakai)} kompetensi yang tidak terpakai perlu diputuskan (petakan, gabungkan, atau pensiunkan) agar kamus ramping dan mudah dipelihara.`
          : "Seluruh kompetensi teknis sudah dipakai; kamus selaras dengan kebutuhan jabatan."
      }
      sumber="Pemakaian kompetensi teknis berstatus lengkap pada pemetaan jabatan_kompetensi."
    >
      <Kolom>
        <View style={[s.kartu, { flex: 1.3, marginRight: 14 }]}>
          <Text style={s.kartuJudul}>KOMPETENSI TEKNIS DIPAKAI PER BIDANG</Text>
          {teknis.map((b) => (
            <BarisBatang
              key={b.kode}
              label={b.nama}
              lebarLabel={190}
              n={b.kompetensi}
              bagian={b.dipakai}
              maks={maks}
              nilai={`${b.dipakai}/${b.kompetensi}`}
              warna="#fde68a"
              warnaBagian={C.brand}
            />
          ))}
          <Legenda items={[[C.brand, "dipakai minimal satu jabatan"], ["#fde68a", "belum dipakai"]]} />
        </View>
        <View style={[s.kartu, { flex: 1, marginRight: 14 }]}>
          <Text style={s.kartuJudul}>PALING BANYAK DIPAKAI</Text>
          {p.terpopuler.map((x) => (
            <View key={x.kode} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 8, fontWeight: "bold" }}>
                <Text style={{ color: C.redup, fontWeight: "normal" }}>{x.kode} </Text>
                {x.nama}
              </Text>
              <BarisBatang label="" lebarLabel={0} n={x.n} maks={maksTop} nilai={`${fmt(x.n)} jabatan`} warna={C.brand} />
            </View>
          ))}
        </View>
      </Kolom>
    </Slide>
  );
}

function Kualitas({ d, edisi }: { d: LaporanData; edisi: string }) {
  const k = d.kualitas;
  const aman = k.cek.filter((c) => !c.n).length;
  const maksCelah = Math.max(1, ...k.celahPerUnit.map((x) => x.butir));
  return (
    <Slide
      bab="Kualitas"
      edisi={edisi}
      judul={`${fmt(k.bersih)} dari ${fmt(k.total)} jabatan (${persen(k.bersih, k.total)}%) lolos semua cek kualitas; ${aman} dari ${k.cek.length} cek tanpa temuan`}
      sub="Cek otomatis atas konsistensi pemetaan: aturan dasar per jenjang, kesetaraan jabatan bernama sama, level bawahan terhadap atasan, dan kecukupan kamus."
      implikasi={
        k.total - k.bersih
          ? `${fmt(k.total - k.bersih)} jabatan dengan temuan perlu dibereskan sebelum pengesahan, agar standar tidak dipersoalkan saat dipakai untuk keputusan SDM.`
          : "Tidak ada temuan; pemetaan siap disahkan dari sisi konsistensi."
      }
      sumber="Halaman Kualitas Pemetaan (cek otomatis atas pemetaan dan uraian tugas)."
    >
      <Kolom>
        <View style={[s.kartu, { flex: 1.25, marginRight: 14 }]}>
          <Text style={s.kartuJudul}>HASIL CEK</Text>
          {k.cek.map((c) => (
            <View key={c.label} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderColor: C.garis, paddingVertical: 6 }}>
              <Text style={[s.chip, { width: 62, textAlign: "center", backgroundColor: c.n ? C.amberMuda : C.hijauMuda, color: c.n ? "#b45309" : C.hijau }]}>
                {c.n ? "PERLU DICEK" : "AMAN"}
              </Text>
              <Text style={{ flex: 1, marginLeft: 8 }}>{c.label}</Text>
              <Text style={{ fontSize: 11, fontWeight: "bold", color: C.navy }}>{c.nilai}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, marginRight: 14 }}>
          <Ubin
            label="TUGAS INTI TANPA PADANAN KAMUS"
            nilai={fmt(k.celah)}
            ket={`dari ${fmt(k.tugasTotal)} butir uraian tugas (${des((k.celah / Math.max(1, k.tugasTotal)) * 100)}%)`}
            warna={k.celah ? C.amber : C.hijau}
          />
          {k.celahPerUnit.length > 0 && (
            <View style={s.kartu}>
              <Text style={s.kartuJudul}>CELAH TERBANYAK PER UNIT</Text>
              {k.celahPerUnit.map((u) => (
                <BarisBatang key={u.unit} label={u.unit} lebarLabel={130} n={u.butir} maks={maksCelah} nilai={`${u.butir} butir`} warna={C.amber} />
              ))}
            </View>
          )}
        </View>
      </Kolom>
    </Slide>
  );
}

function Review({ d, edisi }: { d: LaporanData; edisi: string }) {
  const r = d.review;
  const perlu = Math.ceil(r.draf / TARGET_MINGGU);
  const terlaluLama = !!r.eta && r.eta.getTime() - d.dicetak.getTime() > 2 * 365 * 24 * 60 * 60 * 1000;
  const tepat = r.lajuMinggu >= perlu;
  return (
    <Slide
      bab="Review"
      edisi={edisi}
      judul={
        r.draf
          ? `${fmt(r.selesai)} dari ${fmt(r.total)} jabatan telah final; dibutuhkan sekitar ${fmt(perlu)} jabatan per minggu agar tuntas dalam ${TARGET_MINGGU} minggu`
          : `Seluruh ${fmt(r.total)} jabatan telah selesai direview dan siap disahkan`
      }
      sub="Alur review: konsultan menyusun pemetaan (Draf), menandainya Selesai, lalu menyerahkannya ke Divisi HC untuk pengesahan."
      implikasi={
        !r.draf
          ? "Pemetaan siap diserahkan ke Divisi HC untuk pengesahan."
          : tepat
            ? `Laju saat ini cukup untuk menuntaskan review dalam ${TARGET_MINGGU} minggu; pertahankan dan pantau mingguan.`
            : `Pada laju saat ini target ${TARGET_MINGGU} minggu tidak tercapai. Perlu tambahan kapasitas peninjau atau penjadwalan review per divisi.`
      }
      sumber="Status review per jabatan dan riwayat review 4 minggu terakhir."
    >
      <Kolom>
        <View style={{ width: 220, marginRight: 14 }}>
          <Ubin label="JABATAN FINAL" nilai={`${fmt(r.selesai)}/${fmt(r.total)}`} ket={`${persen(r.selesai, r.total)}% selesai · ${fmt(r.draf)} draf`} warna={C.hijau} />
          <Ubin label="LAJU 4 MINGGU TERAKHIR" nilai={des(r.lajuMinggu)} ket="jabatan ditandai selesai per minggu" warna={C.navy} />
          <Ubin
            label="PERKIRAAN TUNTAS"
            nilai={!r.draf ? "Tuntas" : !r.eta ? "Belum terukur" : terlaluLama ? "> 2 tahun" : tanggal(r.eta)}
            ket={
              !r.draf
                ? undefined
                : !r.eta
                  ? "belum ada jabatan yang ditandai selesai dalam 4 minggu"
                  : terlaluLama
                    ? `laju saat ini baru ${persen(r.lajuMinggu, perlu)}% dari yang dibutuhkan`
                    : "bila laju saat ini bertahan"
            }
            warna={C.amber}
          />
        </View>
        <View style={[s.kartu, { flex: 1, marginRight: 14 }]}>
          <Text style={s.kartuJudul}>PROGRES PER JENJANG</Text>
          {r.perJenjang.map((x) => (
            <BarisBatang
              key={x.jj}
              label={JENJANG_LABEL[x.jj]}
              lebarLabel={140}
              n={x.total}
              bagian={x.selesai}
              maks={Math.max(1, ...r.perJenjang.map((y) => y.total))}
              nilai={`${x.selesai}/${x.total}`}
              warna={C.garis}
              warnaBagian={C.hijau}
            />
          ))}
          <Legenda items={[[C.hijau, "selesai"], [C.garis, "draf"]]} />
        </View>
      </Kolom>
    </Slide>
  );
}

function Rekomendasi({ d, edisi }: { d: LaporanData; edisi: string }) {
  const r = rekomendasi(d);
  return (
    <Slide
      bab="Rekomendasi"
      edisi={edisi}
      judul={`${r.length} langkah prioritas menuju pengesahan standar kompetensi jabatan`}
      sub="Diurutkan menurut dampak terhadap pengesahan; angka dasar diambil dari halaman-halaman sebelumnya."
      sumber="Analisis atas data di halaman Kamus, Pemetaan, Kualitas, dan Review."
    >
      <View style={{ flexDirection: "row", paddingBottom: 5, borderBottomWidth: 1, borderColor: C.navy }}>
        <Text style={[s.label, { width: 26 }]}>#</Text>
        <Text style={[s.label, { flex: 1.25 }]}>LANGKAH</Text>
        <Text style={[s.label, { flex: 1 }]}>DASAR</Text>
        <Text style={[s.label, { width: 120 }]}>PENANGGUNG JAWAB</Text>
      </View>
      {r.map((x, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", borderBottomWidth: 0.5, borderColor: C.garis, paddingVertical: 8 }} wrap={false}>
          <Text style={{ width: 26, fontSize: 13, fontWeight: "bold", color: C.amber }}>{i + 1}</Text>
          <Text style={{ flex: 1.25, fontSize: 9.5, fontWeight: "bold", color: C.navy, paddingRight: 12 }}>{x.aksi}</Text>
          <Text style={{ flex: 1, fontSize: 8.5, color: C.redup, paddingRight: 12 }}>{x.dasar}</Text>
          <Text style={{ width: 120, fontSize: 8.5 }}>{x.pj}</Text>
        </View>
      ))}
    </Slide>
  );
}

function Lampiran({ edisi }: { edisi: string }) {
  const butir: [string, string][] = [
    ["Kamus kompetensi", "Kompetensi inti (berlaku untuk semua jabatan), kepemimpinan (jabatan struktural), dan teknis (per bidang pekerjaan). Tiap kompetensi memiliki lima level beserta indikator perilaku."],
    ["Level target", "Level yang dituntut dari pemangku jabatan: L1 Dasar, L2 Memadai, L3 Mandiri, L4 Mahir, L5 Master."],
    ["Pemetaan", "Penentuan kompetensi dan level target per jabatan, berbasis uraian tugas. Setiap kompetensi teknis dikaitkan dengan butir tugas sebagai bukti."],
    ["Status review", "Draf: masih dikerjakan konsultan. Selesai: siap diserahkan ke Divisi HC untuk pengesahan."],
    ["Cek kualitas", "Pelaksana tanpa kompetensi kepemimpinan, struktural dengan kepemimpinan, setiap jabatan punya kompetensi teknis, level bawahan tidak melebihi atasan, jabatan bernama sama berprofil sama, dan profil yang menyimpang dari jenjangnya (aturan IQR)."],
    ["Pembaruan data", "Seluruh angka dihitung langsung dari basis data aplikasi saat laporan dicetak, sehingga laporan dapat dicetak ulang kapan saja."],
  ];
  return (
    <Slide bab="Lampiran" edisi={edisi} judul="Lampiran: definisi dan metodologi" sumber="Panduan Pengguna aplikasi Kamus Kompetensi.">
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginRight: -14 }}>
        {butir.map(([k, v]) => (
          <View key={k} style={{ width: "50%", paddingRight: 14, marginBottom: 12 }}>
            <Text style={{ fontSize: 9.5, fontWeight: "bold", color: C.navy, marginBottom: 2 }}>{k}</Text>
            <Text style={{ fontSize: 8.5, color: C.teks, textAlign: "justify" }}>{v}</Text>
          </View>
        ))}
      </View>
    </Slide>
  );
}

export function renderLaporanPdf(d: LaporanData, edisi: string) {
  return renderToBuffer(
    <Document title="Laporan Eksekutif Kamus & Pemetaan Kompetensi" author="PT. Bank Pembangunan Daerah Sulawesi Tenggara" subject="Laporan Eksekutif untuk Direksi" language="id">
      <Sampul d={d} edisi={edisi} />
      <Ringkasan d={d} edisi={edisi} />
      <Kamus d={d} edisi={edisi} />
      <Jabatan d={d} edisi={edisi} />
      <Pemetaan d={d} edisi={edisi} />
      <Pemakaian d={d} edisi={edisi} />
      <Kualitas d={d} edisi={edisi} />
      <Review d={d} edisi={edisi} />
      <Rekomendasi d={d} edisi={edisi} />
      <Lampiran edisi={edisi} />
    </Document>,
  );
}

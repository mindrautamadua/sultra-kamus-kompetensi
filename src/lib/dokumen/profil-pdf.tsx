import "server-only";
import path from "node:path";
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { KHAS } from "@/lib/kedekatan";
import { JENJANG_LABEL, KATEGORI_LABEL, LEVEL_NAMA } from "@/lib/labels";
import type { KompetensiProfil, ProfilDoc } from "./data";
import "./font";

// Profil Kompetensi Jabatan: satu jabatan = ringkasan + peta level target + perilaku yang diharapkan di level target.
// Bukan dokumen sumber; gaya mengikuti aplikasi (navy + amber). Karakter di luar subset latin font (mis. panah, ≥) dihindari.

const LOGO = path.join(process.cwd(), "public/brand/logo-bank-sultra.png");
const HALAMAN_TINGGI = 841.89;
const TEPI = 40;

const C = {
  navy: "#121a42",
  brand: "#1f37b4",
  brandMuda: "#bfd0fd",
  amber: "#f59e0b",
  amberMuda: "#fffbeb",
  teks: "#1e293b",
  redup: "#64748b",
  garis: "#e2e8f0",
  latar: "#f8fafc",
  violet: "#6d28d9",
  violetMuda: "#f5f3ff",
  hijau: "#059669",
};
const KATEGORI_WARNA: Record<string, string> = { inti: "#1f37b4", kepemimpinan: "#fbbf24", teknis: "#38bdf8" };
// sama dengan .lv1–.lv5 di globals.css
const LEVEL_WARNA = ["#eef3ff", "#dbe5fe", "#93b0fb", "#2747d9", "#1d2d73"];
const LEVEL_TEKS = ["#1e3192", "#1d2d73", "#121a42", "#fff", "#fff"];
const URUT_KATEGORI = ["inti", "kepemimpinan", "teknis"];

/** "A", "A dan B", "A, B, dan 2 lainnya" */
const sebut = (xs: string[], maks = 2) =>
  xs.length <= maks ? xs.join(" dan ") : `${xs.slice(0, maks).join(", ")}, dan ${xs.length - maks} lainnya`;
const des = (n: number, d = 1) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const rata = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const tanggal = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Makassar" });

const s = StyleSheet.create({
  page: { fontFamily: "Albert Sans", fontSize: 9, lineHeight: 1.35, color: C.teks, paddingTop: 66, paddingBottom: 52, paddingHorizontal: TEPI },
  kepala: { position: "absolute", top: 22, left: TEPI, right: TEPI, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1.5, borderColor: C.amber },
  kepalaLabel: { fontSize: 7, fontWeight: "bold", letterSpacing: 1.2, color: C.brand },
  kaki: { position: "absolute", top: HALAMAN_TINGGI - 36, left: TEPI, right: TEPI, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: C.redup },
  hero: { backgroundColor: C.navy, borderRadius: 6, paddingHorizontal: 20, paddingVertical: 16, color: "#fff" },
  chip: { fontSize: 7, fontWeight: "bold", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, marginRight: 4 },
  judulBagian: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 1.2, color: C.brand, marginTop: 16, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 0.75, borderColor: C.garis },
  sel: { flex: 1, paddingRight: 10 },
  selLabel: { fontSize: 6.5, fontWeight: "bold", letterSpacing: 0.8, color: C.redup, marginBottom: 2 },
  ubin: { flex: 1, borderWidth: 0.75, borderColor: C.garis, borderTopWidth: 2.5, borderRadius: 4, padding: 8, marginRight: 6 },
  ubinNilai: { fontSize: 17, fontWeight: "bold", color: C.navy, lineHeight: 1.1 },
  baris: { flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderColor: C.garis, paddingVertical: 4 },
  grupBaris: { flexDirection: "row", alignItems: "center", backgroundColor: C.latar, paddingVertical: 3, paddingHorizontal: 4, marginTop: 4 },
});

/** Rangkuman bergaya "kesimpulan dulu": komposisi, posisi terhadap pembanding, dan ciri khas jabatan. */
function ringkasan(d: ProfilDoc): string[] {
  const k = d.kompetensi;
  if (!k.length) return ["Jabatan ini belum memiliki pemetaan kompetensi."];
  const n = (kat: string) => k.filter((x) => x.kategori === kat).length;
  const level = rata(k.map((x) => x.level));
  const out = [
    `Jabatan ini menuntut ${k.length} kompetensi (${URUT_KATEGORI.filter((kat) => n(kat))
      .map((kat) => `${n(kat)} ${KATEGORI_LABEL[kat].toLowerCase()}`)
      .join(", ")}) dengan level target rata-rata L${des(level)}.`,
  ];
  const pb = d.pembanding;
  if (pb) {
    const selisih = level - pb.rataLevel;
    const posisi = Math.abs(selisih) < 0.1 ? "setara dengan" : selisih > 0 ? `${des(selisih)} level di atas` : `${des(-selisih)} level di bawah`;
    out.push(`Tuntutan level ini ${posisi} rata-rata ${pb.lingkup} (L${des(pb.rataLevel)}, ${pb.jumlah} jabatan pembanding).`);
  }
  const teknis = k.filter((x) => x.kategori === "teknis").sort((a, b) => b.level - a.level || a.kode.localeCompare(b.kode));
  const khas = teknis.filter((x) => x.sejenjang && x.sejenjang.share < KHAS);
  if (khas.length)
    out.push(`${khas.length} kompetensi teknis menjadi ciri khas jabatan ini karena jarang dimiliki jabatan sejenjang, antara lain ${sebut(khas.map((x) => x.nama))}.`);
  else if (pb && teknis.length) out.push(`Profil kompetensi teknisnya lazim untuk ${pb.lingkup}; tidak ada kompetensi teknis yang khas.`);
  const puncak = teknis.filter((x) => x.level === teknis[0]?.level);
  if (puncak.length && puncak.length < teknis.length)
    out.push(`Tuntutan teknis tertinggi (L${puncak[0].level} ${LEVEL_NAMA[puncak[0].level - 1]}) ada pada ${sebut(puncak.map((x) => x.nama))}.`);
  if (d.jumlahTugas && d.tugasDidukung < d.jumlahTugas)
    out.push(`${d.tugasDidukung} dari ${d.jumlahTugas} butir uraian tugas sudah didukung kompetensi teknis; sisanya bersifat umum atau belum ada padanannya di kamus.`);
  return out;
}

const urutkan = (k: KompetensiProfil[]) =>
  [...k].sort((a, b) => URUT_KATEGORI.indexOf(a.kategori) - URUT_KATEGORI.indexOf(b.kategori) || b.level - a.level || a.kode.localeCompare(b.kode, "id", { numeric: true }));

function KepalaHalaman({ d }: { d: ProfilDoc }) {
  return (
    <View style={s.kepala} fixed>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> */}
      <Image src={LOGO} style={{ height: 22 }} />
      <View style={{ alignItems: "flex-end" }}>
        <Text style={s.kepalaLabel}>PROFIL KOMPETENSI JABATAN</Text>
        <Text style={{ fontSize: 7, color: C.redup }}>
          {d.kode} · {d.nama}
        </Text>
      </View>
    </View>
  );
}

/** Teks dinamis harus anak langsung Page dan diposisikan dengan top (lihat catatan di jobdesk-pdf.tsx). */
function KakiHalaman({ edisi }: { edisi: string }) {
  return (
    <>
      <Text fixed style={[s.kaki, { right: undefined }]}>
        PT. Bank Pembangunan Daerah Sulawesi Tenggara · Kamus Kompetensi · {edisi}
      </Text>
      <Text fixed style={[s.kaki, { left: undefined, textAlign: "right" }]} render={({ subPageNumber, subPageTotalPages }) => `Halaman ${subPageNumber} dari ${subPageTotalPages}`} />
    </>
  );
}

function Hero({ d }: { d: ProfilDoc }) {
  const jalur = [d.direktorat, d.unitInduk, d.unit].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  const selesai = d.review?.status === "selesai";
  return (
    <View style={s.hero}>
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        <Text style={[s.chip, { backgroundColor: "#ffffff22", color: "#fff" }]}>{d.kode}</Text>
        <Text style={[s.chip, { backgroundColor: C.amber, color: C.navy }]}>{JENJANG_LABEL[d.jenjang]?.toUpperCase()}</Text>
        <Text style={[s.chip, selesai ? { backgroundColor: C.hijau, color: "#fff" } : { borderWidth: 0.75, borderColor: C.brandMuda, color: C.brandMuda }]}>
          {selesai ? "PEMETAAN SELESAI" : "DRAF PEMETAAN"}
        </Text>
      </View>
      <Text style={{ fontSize: 20, fontWeight: "bold", lineHeight: 1.15 }}>{d.nama}</Text>
      {jalur.length > 0 && <Text style={{ fontSize: 8.5, color: C.brandMuda, marginTop: 5 }}>{jalur.join("  ·  ")}</Text>}
    </View>
  );
}

function Identitas({ d }: { d: ProfilDoc }) {
  const sel: [string, string][] = [
    ["ATASAN LANGSUNG", d.atasan ?? "-"],
    ["MEMBAWAHI", d.bawahan.length ? `${d.bawahan.length} jabatan` : "-"],
    ["KELOMPOK JABATAN", d.kelompok ?? "-"],
    ["STATUS REVIEW", d.review ? `${d.review.status === "selesai" ? "Selesai" : "Draf"} · ${tanggal(d.review.tanggal)}` : "Draf · belum ditinjau"],
  ];
  return (
    <View style={{ flexDirection: "row", marginTop: 12 }}>
      {sel.map(([k, v]) => (
        <View key={k} style={s.sel}>
          <Text style={s.selLabel}>{k}</Text>
          <Text style={{ fontSize: 8.5 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Ringkasan({ d }: { d: ProfilDoc }) {
  return (
    <View style={{ marginTop: 14, backgroundColor: C.amberMuda, borderLeftWidth: 3, borderColor: C.amber, paddingVertical: 9, paddingHorizontal: 12 }} wrap={false}>
      <Text style={[s.selLabel, { color: "#b45309", marginBottom: 4 }]}>RINGKASAN</Text>
      {ringkasan(d).map((t, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
          <Text style={{ width: 10, color: C.amber, fontWeight: "bold" }}>·</Text>
          <Text style={{ flex: 1, fontSize: 9 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function Ubin({ label, nilai, ket, warna, children }: { label: string; nilai: string; ket: string; warna: string; children?: React.ReactNode }) {
  return (
    <View style={[s.ubin, { borderTopColor: warna }]}>
      <Text style={s.selLabel}>{label}</Text>
      <Text style={s.ubinNilai}>{nilai}</Text>
      {children}
      <Text style={{ fontSize: 7, color: C.redup, marginTop: 3 }}>{ket}</Text>
    </View>
  );
}

function Angka({ d }: { d: ProfilDoc }) {
  const k = d.kompetensi;
  const level = rata(k.map((x) => x.level));
  const pb = d.pembanding;
  const khas = k.filter((x) => x.kategori === "teknis" && x.sejenjang && x.sejenjang.share < KHAS);
  return (
    <View style={{ flexDirection: "row", marginTop: 12, marginRight: -6 }} wrap={false}>
      <Ubin label="KOMPETENSI" nilai={String(k.length)} ket={pb ? `rata-rata sejenjang ${des(pb.rataKomp)}` : "tanpa pembanding sejenjang"} warna={C.brand}>
        <View style={{ flexDirection: "row", height: 3, marginTop: 4, borderRadius: 2, overflow: "hidden" }}>
          {URUT_KATEGORI.map((kat) => {
            const n = k.filter((x) => x.kategori === kat).length;
            return n > 0 && <View key={kat} style={{ flex: n, backgroundColor: KATEGORI_WARNA[kat] }} />;
          })}
        </View>
      </Ubin>
      <Ubin label="LEVEL TARGET RATA-RATA" nilai={k.length ? `L${des(level)}` : "-"} ket={pb ? `sejenjang L${des(pb.rataLevel)}` : "tanpa pembanding sejenjang"} warna={C.navy} />
      <Ubin label="KOMPETENSI KHAS" nilai={String(khas.length)} ket={`dimiliki < ${Math.round(KHAS * 100)}% jabatan sejenjang`} warna={C.violet} />
      <Ubin
        label="TUGAS DIDUKUNG"
        nilai={d.jumlahTugas ? `${d.tugasDidukung}/${d.jumlahTugas}` : "-"}
        ket={d.jumlahTugas ? "butir uraian tugas berbukti kompetensi" : "uraian tugas belum tersedia"}
        warna={d.jumlahTugas && d.tugasDidukung < d.jumlahTugas ? C.amber : C.hijau}
      />
    </View>
  );
}

const SKALA_LEBAR = 108;

/** Lima kotak level; terisi sampai level target, garis amber = rata-rata level jabatan sejenjang. */
function Skala({ level, sejenjang }: { level: number; sejenjang: number }) {
  return (
    <View style={{ width: SKALA_LEBAR, flexDirection: "row", position: "relative" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={{ flex: 1, height: 9, marginRight: n < 5 ? 2 : 0, borderRadius: 1.5, backgroundColor: n <= level ? LEVEL_WARNA[level - 1] : C.garis }} />
      ))}
      {sejenjang > 0 && <View style={{ position: "absolute", top: -2.5, left: (sejenjang / 5) * SKALA_LEBAR - 0.75, width: 1.5, height: 14, backgroundColor: C.amber }} />}
    </View>
  );
}

function PetaKompetensi({ d }: { d: ProfilDoc }) {
  const k = urutkan(d.kompetensi);
  return (
    <View break>
      <Text style={[s.judulBagian, { marginTop: 0 }]}>
        PETA LEVEL TARGET KOMPETENSI
      </Text>
      <View style={{ flexDirection: "row", fontSize: 6.5, fontWeight: "bold", color: C.redup, paddingBottom: 3, paddingHorizontal: 4 }}>
        <Text style={{ width: 52 }}>KODE</Text>
        <Text style={{ flex: 1 }}>KOMPETENSI</Text>
        <Text style={{ width: 38 }} />
        <View style={{ width: SKALA_LEBAR, flexDirection: "row" }}>
          {LEVEL_NAMA.map((_, i) => (
            <Text key={i} style={{ flex: 1, textAlign: "center" }}>
              {i + 1}
            </Text>
          ))}
        </View>
        <Text style={{ width: 74, textAlign: "right" }}>LEVEL TARGET</Text>
      </View>
      {URUT_KATEGORI.map((kat) => {
        const rows = k.filter((x) => x.kategori === kat);
        if (!rows.length) return null;
        return (
          <View key={kat}>
            <View style={s.grupBaris} minPresenceAhead={30}>
              <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: KATEGORI_WARNA[kat], marginRight: 5 }} />
              <Text style={{ fontSize: 7, fontWeight: "bold", letterSpacing: 0.8, color: C.redup }}>
                KOMPETENSI {KATEGORI_LABEL[kat].toUpperCase()} · {rows.length}
              </Text>
            </View>
            {rows.map((x) => {
              const khas = x.kategori === "teknis" && x.sejenjang && x.sejenjang.share < KHAS;
              return (
                <View key={x.kode} style={[s.baris, { paddingHorizontal: 4 }]} wrap={false}>
                  <Text style={{ width: 52, fontSize: 7.5, color: C.redup }}>{x.kode}</Text>
                  <Text style={{ flex: 1, fontWeight: "bold", paddingRight: 8 }}>{x.nama}</Text>
                  <View style={{ width: 38 }}>{khas && <Text style={[s.chip, { alignSelf: "flex-start", backgroundColor: C.violetMuda, color: C.violet }]}>KHAS</Text>}</View>
                  <Skala level={x.level} sejenjang={x.sejenjang?.level ?? 0} />
                  <Text style={{ width: 74, textAlign: "right" }}>
                    <Text style={{ fontWeight: "bold" }}>L{x.level}</Text> {x.namaLevel || LEVEL_NAMA[x.level - 1]}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, fontSize: 7, color: C.redup }}>
        <View style={{ width: 1.5, height: 9, backgroundColor: C.amber, marginRight: 4 }} />
        <Text style={{ marginRight: 12 }}>rata-rata level {d.pembanding ? d.pembanding.lingkup : "jabatan sejenjang"}</Text>
        <Text style={[s.chip, { backgroundColor: C.violetMuda, color: C.violet }]}>KHAS</Text>
        <Text>dimiliki kurang dari {Math.round(KHAS * 100)}% jabatan sejenjang</Text>
      </View>
    </View>
  );
}

function Ikhtisar({ d }: { d: ProfilDoc }) {
  if (!d.fungsi.length) return null;
  return (
    <View>
      <Text style={s.judulBagian}>IKHTISAR JABATAN</Text>
      {d.fungsi.map((f, i) => (
        <Text key={i} style={{ textAlign: "justify", marginBottom: 3 }}>
          {f}
        </Text>
      ))}
    </View>
  );
}

function BlokPerilaku({ x }: { x: KompetensiProfil }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 10 }} wrap={false}>
      <View style={{ width: 3, backgroundColor: KATEGORI_WARNA[x.kategori], borderRadius: 1.5, marginRight: 9 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ fontSize: 7, color: C.redup }}>
              {x.kode} · {x.kategori === "teknis" && x.bidang ? x.bidang : `Kompetensi ${KATEGORI_LABEL[x.kategori]}`}
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: "bold", color: C.navy }}>{x.nama}</Text>
          </View>
          <Text style={[s.chip, { marginRight: 0, fontSize: 7.5, backgroundColor: LEVEL_WARNA[x.level - 1], color: LEVEL_TEKS[x.level - 1] }]}>
            L{x.level} · {(x.namaLevel || LEVEL_NAMA[x.level - 1]).toUpperCase()}
          </Text>
        </View>
        {x.definisi && <Text style={{ fontSize: 8, color: C.redup, fontStyle: "italic", marginTop: 2, textAlign: "justify" }}>{x.definisi}</Text>}
        {x.perilaku && (
          <Text style={{ marginTop: 4, textAlign: "justify" }}>
            <Text style={{ fontWeight: "bold" }}>Perilaku utama: </Text>
            {x.perilaku}
          </Text>
        )}
        {x.indikator.length > 0 ? (
          <View style={{ marginTop: 3 }}>
            {x.indikator.map((t, i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: 1.5 }}>
                <Text style={{ width: 14, color: C.brand, fontWeight: "bold" }}>{i + 1}.</Text>
                <Text style={{ flex: 1, textAlign: "justify" }}>{t}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ marginTop: 3, fontStyle: "italic", color: C.redup }}>Indikator perilaku untuk level ini belum disusun di kamus.</Text>
        )}
      </View>
    </View>
  );
}

function Perilaku({ d }: { d: ProfilDoc }) {
  const k = urutkan(d.kompetensi);
  if (!k.length) return null;
  return (
    <View>
      <Text style={[s.judulBagian, { marginTop: 22 }]} minPresenceAhead={120}>
        PERILAKU YANG DIHARAPKAN DI LEVEL TARGET
      </Text>
      <Text style={{ fontSize: 8, color: C.redup, marginBottom: 10 }}>
        Indikator perilaku berikut menjadi acuan seleksi, penilaian kinerja, dan pengembangan pemangku jabatan. Indikator level di bawah target
        dianggap sudah dikuasai; rinciannya ada di Kamus Kompetensi.
      </Text>
      {k.map((x) => (
        <BlokPerilaku key={x.kode} x={x} />
      ))}
    </View>
  );
}

function Pengesahan() {
  return (
    <View wrap={false} style={{ marginTop: 8 }}>
      <Text style={s.judulBagian}>PENGESAHAN</Text>
      <View style={{ flexDirection: "row", marginRight: -8 }}>
        {["Disusun oleh", "Diperiksa oleh", "Disetujui oleh"].map((t) => (
          <View key={t} style={{ flex: 1, marginRight: 8, borderWidth: 0.75, borderColor: C.garis, borderRadius: 4, padding: 8, height: 78, justifyContent: "space-between" }}>
            <Text style={s.selLabel}>{t.toUpperCase()}</Text>
            <View style={{ borderTopWidth: 0.75, borderColor: C.redup, paddingTop: 2 }}>
              <Text style={{ fontSize: 7, color: C.redup }}>Nama, jabatan & tanggal</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function HalamanProfil({ d, edisi }: { d: ProfilDoc; edisi: string }) {
  return (
    <Page size="A4" style={s.page}>
      <KepalaHalaman d={d} />
      <KakiHalaman edisi={edisi} />
      <Hero d={d} />
      <Identitas d={d} />
      <Ringkasan d={d} />
      {d.kompetensi.length > 0 && <Angka d={d} />}
      <Ikhtisar d={d} />
      {d.kompetensi.length > 0 && <PetaKompetensi d={d} />}
      <Perilaku d={d} />
      <Pengesahan />
    </Page>
  );
}

export function renderProfilPdf(docs: ProfilDoc[], judul: string, edisi: string) {
  return renderToBuffer(
    <Document title={judul} author="PT. Bank Pembangunan Daerah Sulawesi Tenggara" subject="Profil Kompetensi Jabatan" language="id">
      {docs.map((d, i) => (
        <HalamanProfil key={i} d={d} edisi={edisi} />
      ))}
    </Document>,
  );
}

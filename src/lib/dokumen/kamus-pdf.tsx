import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BidangDoc, KompetensiDoc } from "./data";
import "./font";

// Tata letak meniru "GT-Kamus Core & Leadership Competency Bank Sultra (Matriks 5 Tingkat).docx":
// judul, daftar kompetensi, lalu per kompetensi definisi + tabel "Level & Perilaku Utama | Indikator Perilaku".

const NAVY = "#17365d";
const GARIS = "#000";

const s = StyleSheet.create({
  page: { fontFamily: "Tinos", fontSize: 10.5, lineHeight: 1.3, color: NAVY, paddingTop: 56, paddingBottom: 56, paddingHorizontal: 64 },
  judul: { fontWeight: "bold", fontSize: 17, lineHeight: 1.25, textAlign: "center", marginBottom: 2 },
  judulSub: { fontWeight: "bold", fontStyle: "italic", fontSize: 15, textAlign: "center" },
  daftar: { flexDirection: "row", marginBottom: 1 },
  kompetensiJudul: { fontWeight: "bold", fontSize: 12.5, marginTop: 18, marginBottom: 4 },
  definisi: { textAlign: "justify", marginBottom: 8 },
  tabel: { borderTopWidth: 1, borderColor: GARIS },
  // garis kiri per baris, bukan di wadah tabel: wadah yang terpotong halaman memanjang sampai dasar halaman
  baris: { flexDirection: "row", borderLeftWidth: 1, borderBottomWidth: 1, borderColor: GARIS },
  kolomLevel: { width: "39%", borderRightWidth: 1, borderColor: GARIS, padding: 3 },
  kolomIndikator: { flex: 1, borderRightWidth: 1, borderColor: GARIS, padding: 3 },
  kepalaTabel: { backgroundColor: "#ddeefb", fontWeight: "bold", textAlign: "center" },
  nomorHalaman: { position: "absolute", top: 800, left: 64, right: 64, fontSize: 9, textAlign: "right", color: "#555" },
});

function judulBidang(b: BidangDoc): [string, string?] {
  if (b.kode === "CC") return ["KAMUS KOMPETENSI INTI", "(CORE COMPETENCIES)"];
  if (b.kode === "LC") return ["KAMUS KOMPETENSI KEPEMIMPINAN", "(LEADERSHIP COMPETENCIES)"];
  return [`KAMUS KOMPETENSI BIDANG ${b.nama.toUpperCase()} (${b.kode})`];
}

type Level = KompetensiDoc["level"][number];

function BarisLevel({ l }: { l: Level }) {
  return (
    <View style={s.baris} wrap={false}>
      <View style={s.kolomLevel}>
        <Text style={{ fontWeight: "bold", marginBottom: 4 }}>
          L{l.level} - {l.nama_level}
        </Text>
        <Text style={{ textAlign: "justify" }}>{l.deskripsi}</Text>
      </View>
      <View style={s.kolomIndikator}>
        {l.indikator.map((t, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
            <Text style={{ width: 14 }}>{String.fromCharCode(97 + i)}.</Text>
            <Text style={{ flex: 1, textAlign: "justify" }}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BlokKompetensi({ k }: { k: KompetensiDoc }) {
  const [pertama, ...sisa] = k.level;
  // judul, definisi, kepala tabel, dan baris L1 tidak boleh terpisah halaman
  return (
    <View>
      <View wrap={false}>
        <Text style={s.kompetensiJudul}>
          Kode & Nama Kompetensi: ({k.kode}) {k.nama}
        </Text>
        <Text style={s.definisi}>
          <Text style={{ fontWeight: "bold" }}>Definisi: </Text>
          {k.definisi ?? "-"}
        </Text>
        {pertama ? (
          <View style={s.tabel}>
            <View style={[s.baris, s.kepalaTabel]}>
              <Text style={s.kolomLevel}>Level & Perilaku Utama</Text>
              <Text style={s.kolomIndikator}>Indikator Perilaku</Text>
            </View>
            <BarisLevel l={pertama} />
          </View>
        ) : (
          <Text style={{ fontStyle: "italic", color: "#555" }}>Tabel level kompetensi belum disusun.</Text>
        )}
      </View>
      {sisa.length > 0 && (
        <View>
          {sisa.map((l) => (
            <BarisLevel key={l.level} l={l} />
          ))}
        </View>
      )}
    </View>
  );
}

function NomorHalaman() {
  return <Text style={s.nomorHalaman} fixed render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} />;
}

function HalamanBidang({ b }: { b: BidangDoc }) {
  const [judul, sub] = judulBidang(b);
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.judul}>{judul}</Text>
      {sub && <Text style={s.judulSub}>{sub}</Text>}
      <Text style={{ textAlign: "center", fontSize: 10, marginTop: 4, marginBottom: 16 }}>PT. Bank Pembangunan Daerah Sulawesi Tenggara</Text>
      {b.kompetensi.map((k, i) => (
        <View key={k.kode} style={s.daftar}>
          <Text style={{ width: 22, textAlign: "right", paddingRight: 4 }}>{i + 1}.</Text>
          <Text style={{ flex: 1 }}>
            ({k.kode}) {k.nama}
          </Text>
        </View>
      ))}
      {b.kompetensi.map((k) => (
        <BlokKompetensi key={k.kode} k={k} />
      ))}
      <NomorHalaman />
    </Page>
  );
}

export function renderKamusPdf(bidang: BidangDoc[], judul: string) {
  return renderToBuffer(
    <Document title={judul} author="PT. Bank Pembangunan Daerah Sulawesi Tenggara" subject="Kamus Kompetensi" language="id">
      {bidang.map((b) => (
        <HalamanBidang key={b.kode} b={b} />
      ))}
    </Document>,
  );
}

export function renderKompetensiPdf(k: KompetensiDoc) {
  return renderToBuffer(
    <Document title={`${k.kode} ${k.nama}`} author="PT. Bank Pembangunan Daerah Sulawesi Tenggara" subject="Kamus Kompetensi" language="id">
      <Page size="A4" style={s.page}>
        <BlokKompetensi k={k} />
        <NomorHalaman />
      </Page>
    </Document>,
  );
}

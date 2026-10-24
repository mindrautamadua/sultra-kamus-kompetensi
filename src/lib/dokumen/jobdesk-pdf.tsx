import "server-only";
import path from "node:path";
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { JENJANG_LABEL } from "@/lib/labels";
import "./font";
import type { JobdeskDoc, Tugas } from "./data";

// Tata letak meniru dokumen "Uraian Tugas Pegawai" di sumber-data/ (Perubahan Ketiga, 10 Juli 2026).
// Font asli (FS Albert) tidak tersedia, diganti Albert Sans (lihat font.ts).

export const TANGGAL_DOKUMEN = "10/07/2026";
const LOGO = path.join(process.cwd(), "public/brand/logo-bank-sultra.png");
const GARIS = "#000";
const HEADER_TINGGI = 96;
const FOOTER_TINGGI = 34;

const s = StyleSheet.create({
  page: {
    fontFamily: "Albert Sans",
    fontSize: 9.5,
    lineHeight: 1.3,
    paddingTop: 36 + HEADER_TINGGI + 14,
    paddingBottom: 36 + FOOTER_TINGGI + 14,
    paddingHorizontal: 48,
  },
  bingkai: { position: "absolute", top: 30, bottom: 30, left: 40, right: 40, borderWidth: 1, borderColor: GARIS },
  header: { position: "absolute", top: 36, left: 48, right: 48, height: HEADER_TINGGI, flexDirection: "row" },
  logoSel: { width: "26%", justifyContent: "center", alignItems: "center", borderWidth: 1, borderRightWidth: 0, borderColor: GARIS },
  judulSel: { width: "44%", borderWidth: 1, borderColor: GARIS },
  judulBaris: { flex: 1, justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderColor: GARIS, paddingHorizontal: 4 },
  metaSel: { width: "30%", borderWidth: 1, borderLeftWidth: 0, borderColor: GARIS },
  metaBaris: { flex: 1, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: GARIS, paddingHorizontal: 4, fontSize: 7.5 },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 48,
    right: 48,
    height: FOOTER_TINGGI,
    borderWidth: 1,
    borderColor: GARIS,
    justifyContent: "center",
    alignItems: "center",
  },
  tabel: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: GARIS },
  baris: { flexDirection: "row", borderBottomWidth: 1, borderColor: GARIS },
  label: { width: 118, borderRightWidth: 1, borderColor: GARIS, paddingHorizontal: 4, paddingVertical: 2, fontWeight: "bold" },
  isi: { flex: 1, borderRightWidth: 1, borderColor: GARIS, paddingHorizontal: 4, paddingVertical: 2, textAlign: "justify" },
  item: { flexDirection: "row", marginBottom: 3 },
  nomor: { width: 22, textAlign: "right", paddingRight: 5 },
  itemTeks: { flex: 1, textAlign: "justify" },
});

/** Label baris ketiga kepala dokumen (PELAKSANA, KEPALA BAGIAN, ...), diambil dari nama jabatan. */
function labelJabatan(d: JobdeskDoc) {
  const m = d.nama.match(
    /^(Pelaksana|Wakil Pemimpin Cabang|Pemimpin Cabang Pembantu|Pemimpin Cabang|Pemimpin Kantor Fungsional|Kepala (Divisi|Bagian|Seksi|Kelompok|Unit|Satuan Kerja)|Koordinator|Direktur Utama|Direktur)/i,
  );
  return (m ? m[0] : JENJANG_LABEL[d.jenjang] ?? "").toUpperCase();
}

function KepalaDokumen({ d }: { d: JobdeskDoc }) {
  const meta: [string, string][] = [
    ["No. Dok.", d.kodeDokumen],
    ["Halaman", ""], // diisi NomorHalaman
    ["Revisi", ""],
    ["Tanggal", TANGGAL_DOKUMEN],
    ["Pembuat", ""],
    ["Penyetuju", ""],
  ];
  return (
    <View style={s.header} fixed>
      <View style={s.logoSel}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> */}
        <Image src={LOGO} style={{ width: 104 }} />
      </View>
      <View style={s.judulSel}>
        <View style={s.judulBaris}>
          <Text style={{ fontWeight: "bold", fontSize: 13 }}>URAIAN TUGAS PEGAWAI</Text>
        </View>
        <View style={s.judulBaris}>
          <Text style={{ fontWeight: "bold", fontSize: 8.5, textAlign: "center" }}>
            PT. BANK PEMBANGUNAN DAERAH{"\n"}SULAWESI TENGGARA
          </Text>
        </View>
        <View style={[s.judulBaris, { borderBottomWidth: 0 }]}>
          <Text style={{ fontWeight: "bold", fontSize: 10 }}>{labelJabatan(d)}</Text>
        </View>
      </View>
      <View style={s.metaSel}>
        {meta.map(([k, v], i) => (
          <View key={k} style={[s.metaBaris, i === meta.length - 1 ? { borderBottomWidth: 0 } : {}]}>
            <Text style={{ width: 42, fontWeight: "bold" }}>{k}</Text>
            <Text style={{ width: 8 }}>:</Text>
            <Text>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Nomor halaman per jabatan (subPageNumber), diletakkan absolut tepat di sel "Halaman".
 * Teks dinamis di dalam View kepala dokumen tidak ikut tergambar, jadi harus anak langsung Page.
 */
function NomorHalaman() {
  return (
    <Text
      fixed
      style={{ position: "absolute", top: 36 + HEADER_TINGGI / 6 + 4, left: 48 + (595.28 - 96) * 0.7 + 4 + 50, fontSize: 7.5 }}
      render={({ subPageNumber }) => String(subPageNumber)}
    />
  );
}

function Baris({ label, children, wrap = true }: { label: string; children: React.ReactNode; wrap?: boolean }) {
  return (
    <View style={s.baris} wrap={wrap}>
      <Text style={s.label}>{label}</Text>
      <View style={s.isi}>{children}</View>
    </View>
  );
}

function Daftar({ items, mulai = 1 }: { items: string[]; mulai?: number }) {
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={s.item} wrap={false}>
          <Text style={s.nomor}>{mulai + i}.</Text>
          <Text style={s.itemTeks}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function SyaratJabatan({ d }: { d: JobdeskDoc }) {
  const syarat = (
    [
      ["Pendidikan", d.pendidikan],
      ["Pendidikan Tambahan", d.pendidikanTambahan],
      ["Pangkat", d.pangkat],
      ["Pengalaman Kerja", d.pengalaman],
      ["Kompetensi", d.kompetensi],
    ] as const
  ).filter(([, v]) => v);
  if (!syarat.length) return <Baris label="Syarat Jabatan">-</Baris>;
  const bernomor = syarat.length > 1;
  return (
    <View style={s.baris} wrap={false}>
      <Text style={s.label}>Syarat Jabatan</Text>
      <View style={{ flex: 1, borderRightWidth: 1, borderColor: GARIS }}>
        {syarat.map(([k, v], i) => (
          <View key={k} style={[{ flexDirection: "row" }, i < syarat.length - 1 ? { borderBottomWidth: 1, borderColor: GARIS } : {}]}>
            <View style={{ width: 120, flexDirection: "row", borderRightWidth: 1, borderColor: GARIS, paddingHorizontal: 4, paddingVertical: 2 }}>
              {bernomor && <Text style={{ width: 14 }}>{i + 1}.</Text>}
              <Text>{k}</Text>
            </View>
            <Text style={{ flex: 1, paddingHorizontal: 4, paddingVertical: 2, textAlign: "justify" }}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Kelompokkan tugas berurutan dengan kategori yang sama (Perencanaan, Pengorganisasian, ...). */
function kelompokTugas(tugas: Tugas[]) {
  const out: { kategori: string | null; items: string[]; mulai: number }[] = [];
  tugas.forEach((t, i) => {
    const akhir = out.at(-1);
    if (akhir && akhir.kategori === t.kategori) akhir.items.push(t.deskripsi);
    else out.push({ kategori: t.kategori, items: [t.deskripsi], mulai: i + 1 });
  });
  return out;
}

function TugasPokok({ tugas }: { tugas: Tugas[] }) {
  if (!tugas.length) return <Baris label="Tugas Pokok">-</Baris>;
  const kelompok = kelompokTugas(tugas);
  if (kelompok.every((k) => !k.kategori)) {
    return (
      <Baris label="Tugas Pokok">
        <Daftar items={kelompok[0].items} />
      </Baris>
    );
  }
  return (
    <>
      <View style={s.baris} minPresenceAhead={60}>
        <Text style={{ flex: 1, textAlign: "center", fontWeight: "bold", borderRightWidth: 1, borderColor: GARIS, paddingVertical: 2 }}>
          Tugas Pokok
        </Text>
      </View>
      {kelompok.map((k, i) => (
        <View key={i} style={s.baris}>
          <View style={[s.label, { flexDirection: "row" }]}>
            {k.kategori && <Text style={{ width: 16 }}>{String.fromCharCode(65 + i)}</Text>}
            <Text style={{ flex: 1 }}>{k.kategori ?? "Tugas Pokok"}</Text>
          </View>
          <View style={s.isi}>
            <Daftar items={k.items} mulai={k.mulai} />
          </View>
        </View>
      ))}
    </>
  );
}

function HalamanJobdesk({ d }: { d: JobdeskDoc }) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.bingkai} fixed />
      <KepalaDokumen d={d} />
      <NomorHalaman />
      <View style={s.tabel}>
        <Baris label="Jabatan">
          <Text>{d.nama}</Text>
        </Baris>
        <Baris label="Atasan Langsung">
          <Text>{d.atasan ?? "-"}</Text>
        </Baris>
        {d.membawahi.length > 0 && (
          <Baris label="Membawahi" wrap={false}>
            <Daftar items={d.membawahi} />
          </Baris>
        )}
        <SyaratJabatan d={d} />
        <Baris label="Fungsi">
          {d.fungsi.length ? d.fungsi.map((f, i) => <Text key={i}>{f}</Text>) : <Text>-</Text>}
        </Baris>
        <TugasPokok tugas={d.tugas} />
      </View>
      <View style={s.footer} fixed>
        <Text style={{ fontWeight: "bold", fontSize: 14 }}>Maju Bersama</Text>
      </View>
    </Page>
  );
}

export function renderJobdeskPdf(docs: JobdeskDoc[], judul: string) {
  return renderToBuffer(
    <Document title={judul} author="PT. Bank Pembangunan Daerah Sulawesi Tenggara" subject="Uraian Tugas Pegawai" language="id">
      {docs.map((d, i) => (
        <HalamanJobdesk key={i} d={d} />
      ))}
    </Document>,
  );
}

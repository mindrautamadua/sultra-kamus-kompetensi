import "server-only";
import path from "node:path";
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { JENJANG_LABEL, KATEGORI_LABEL, LEVEL_NAMA } from "@/lib/labels";
import type { Matriks, MatriksJabatan, MatriksKompetensi } from "@/lib/matriks";
import "./font";

// Matriks Kompetensi per Divisi, A3 landscape: jabatan (baris) x kompetensi (kolom), sel = level target.
// Halaman dipecah manual (baris & kolom) supaya header kolom selalu terulang. Satu divisi terbesar (±20 jabatan,
// ±56 kompetensi) muat di satu halaman. Karakter di luar subset latin font (mis. panah, ≥) dihindari.

const LOGO = path.join(process.cwd(), "public/brand/logo-bank-sultra.png");
const LEBAR = 1190.55;
const TINGGI = 841.89;
const TEPI = 32;
const ATAS = 64;
const BAWAH = 40;

const KOL_JABATAN = 270;
const KOL_RINGKAS = 48;
const SEL_MAKS = 24;
const SEL_MIN = 13;
const TINGGI_KATEGORI = 13;
const TINGGI_NAMA = 200;
const TINGGI_DIPAKAI = 13;
const TINGGI_BARIS = 14;
const TINGGI_JUDUL = 42;
const TINGGI_RINGKASAN = 62;
const NAMA_MAKS = 56;

const C = {
  navy: "#121a42",
  brand: "#1f37b4",
  brandMuda: "#bfd0fd",
  amber: "#f59e0b",
  amberMuda: "#fffbeb",
  teks: "#1e293b",
  redup: "#64748b",
  garis: "#e2e8f0",
  garisTipis: "#f1f5f9",
  latar: "#f8fafc",
};
const KATEGORI_WARNA: Record<string, string> = { inti: "#1f37b4", kepemimpinan: "#fbbf24", teknis: "#38bdf8" };
// sama dengan .lv1–.lv5 di globals.css
const LEVEL_WARNA = ["#eef3ff", "#dbe5fe", "#93b0fb", "#2747d9", "#1d2d73"];
const LEVEL_TEKS = ["#1e3192", "#1d2d73", "#121a42", "#fff", "#fff"];
const URUT_KATEGORI = ["inti", "kepemimpinan", "teknis"];

const des = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const persen = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const potong = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

const s = StyleSheet.create({
  page: { fontFamily: "Albert Sans", fontSize: 7, lineHeight: 1.2, color: C.teks, paddingTop: ATAS, paddingBottom: BAWAH, paddingHorizontal: TEPI },
  kepala: { position: "absolute", top: 22, left: TEPI, right: TEPI, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1.5, borderColor: C.amber },
  kepalaLabel: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 1.2, color: C.brand },
  kaki: { position: "absolute", top: TINGGI - 28, left: TEPI, right: TEPI, fontSize: 7, color: C.redup },
  selLabel: { fontSize: 6.5, fontWeight: "bold", letterSpacing: 0.8, color: C.redup },
  ubin: { borderLeftWidth: 2.5, paddingLeft: 7, marginRight: 22 },
  ubinNilai: { fontSize: 17, fontWeight: "bold", color: C.navy, lineHeight: 1.1 },
});

export type MatriksDivisi = { divisi: string; jabatan: MatriksJabatan[]; kompetensi: MatriksKompetensi[]; level: Map<string, number> };

/** Pecah matriks gabungan menjadi per divisi (unit induk); kolom tiap divisi = kompetensi yang dipakai di divisi itu. */
export function perDivisi(m: Matriks, kolom: "kode" | "umum"): MatriksDivisi[] {
  const grup = new Map<string, MatriksJabatan[]>();
  for (const j of m.jabatan) grup.set(j.unit_induk_nama, [...(grup.get(j.unit_induk_nama) ?? []), j]);
  return [...grup].map(([divisi, jabatan]) => {
    const dipakai = new Map<string, number>();
    for (const j of jabatan) for (const k of m.kompetensi) if (m.level.has(`${j.id}|${k.kode}`)) dipakai.set(k.kode, (dipakai.get(k.kode) ?? 0) + 1);
    const ks = m.kompetensi.filter((k) => dipakai.has(k.kode));
    if (kolom === "umum")
      ks.sort((a, b) => URUT_KATEGORI.indexOf(a.kategori) - URUT_KATEGORI.indexOf(b.kategori) || dipakai.get(b.kode)! - dipakai.get(a.kode)!);
    return { divisi, jabatan, kompetensi: ks, level: m.level };
  });
}

type Baris = { unit: string } | { j: MatriksJabatan };

function hitung(d: MatriksDivisi) {
  const perKolom = new Map<string, number>();
  const perBaris = new Map<number, { n: number; jumlah: number }>();
  const level = [0, 0, 0, 0, 0];
  for (const j of d.jabatan) {
    const b = { n: 0, jumlah: 0 };
    for (const k of d.kompetensi) {
      const lv = d.level.get(`${j.id}|${k.kode}`);
      if (!lv) continue;
      b.n++;
      b.jumlah += lv;
      level[lv - 1]++;
      perKolom.set(k.kode, (perKolom.get(k.kode) ?? 0) + 1);
    }
    perBaris.set(j.id, b);
  }
  const terisi = level.reduce((a, b) => a + b, 0);
  return { perKolom, perBaris, level, terisi, rata: terisi ? level.reduce((t, c, i) => t + c * (i + 1), 0) / terisi : 0 };
}
type Hitung = ReturnType<typeof hitung>;

function KepalaHalaman({ judul }: { judul: string }) {
  return (
    <View style={s.kepala} fixed>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> */}
      <Image src={LOGO} style={{ height: 22 }} />
      <View style={{ alignItems: "flex-end" }}>
        <Text style={s.kepalaLabel}>MATRIKS KOMPETENSI JABATAN</Text>
        <Text style={{ fontSize: 7, color: C.redup }}>{judul}</Text>
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
      <Text fixed style={[s.kaki, { left: undefined, textAlign: "right" }]} render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} />
    </>
  );
}

function Legenda() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {LEVEL_NAMA.map((n, i) => (
        <View key={n} style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
          <Text style={{ width: 11, height: 11, paddingTop: 2, textAlign: "center", fontSize: 6.5, fontWeight: "bold", backgroundColor: LEVEL_WARNA[i], color: LEVEL_TEKS[i], borderRadius: 1.5 }}>
            {i + 1}
          </Text>
          <Text style={{ marginLeft: 3, color: C.redup }}>{n}</Text>
        </View>
      ))}
    </View>
  );
}

function Judul({ d, sub, bagian }: { d: MatriksDivisi; sub: string; bagian: string }) {
  return (
    <View style={{ height: TINGGI_JUDUL, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 8 }}>
      <View>
        <Text style={{ fontSize: 15, lineHeight: 1.25, fontWeight: "bold", color: C.navy, marginBottom: 2 }}>{d.divisi}</Text>
        <Text style={{ fontSize: 7.5, color: C.redup }}>
          {sub}
          {bagian}
        </Text>
      </View>
      <Legenda />
    </View>
  );
}

function Ringkasan({ d, h, usulan }: { d: MatriksDivisi; h: Hitung; usulan: boolean }) {
  const sel = d.jabatan.length * d.kompetensi.length;
  const angka: [string, string, string][] = [
    ["JABATAN", String(d.jabatan.length), C.brand],
    ["KOMPETENSI", String(d.kompetensi.length), "#38bdf8"],
    ["SEL TERISI", `${persen(h.terisi, sel)}%`, C.amber],
    ["RATA-RATA LEVEL", h.terisi ? `L${des(h.rata)}` : "-", C.navy],
  ];
  const kat = URUT_KATEGORI.map((k) => [k, d.kompetensi.filter((x) => x.kategori === k).length] as const).filter(([, n]) => n);
  return (
    <View style={{ height: TINGGI_RINGKASAN, flexDirection: "row", alignItems: "flex-start", backgroundColor: C.latar, borderRadius: 4, padding: 10, marginBottom: 8 }}>
      {angka.map(([l, n, w]) => (
        <View key={l} style={[s.ubin, { borderLeftColor: w }]}>
          <Text style={s.selLabel}>{l}</Text>
          <Text style={s.ubinNilai}>{n}</Text>
        </View>
      ))}
      <View style={{ marginRight: 22 }}>
        <Text style={[s.selLabel, { marginBottom: 3 }]}>KOMPOSISI KOLOM</Text>
        {kat.map(([k, n]) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", marginBottom: 1 }}>
            <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: KATEGORI_WARNA[k], marginRight: 4 }} />
            <Text>
              {n} {KATEGORI_LABEL[k].toLowerCase()}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.selLabel, { marginBottom: 4 }]}>SEBARAN {h.terisi} SEL MENURUT LEVEL TARGET</Text>
        <View style={{ flexDirection: "row", height: 8, borderRadius: 2, overflow: "hidden", backgroundColor: C.garis }}>
          {h.level.map((c, i) => c > 0 && <View key={i} style={{ flex: c, backgroundColor: LEVEL_WARNA[i] }} />)}
        </View>
        <View style={{ flexDirection: "row", marginTop: 3 }}>
          {h.level.map((c, i) => (
            <Text key={i} style={{ flex: 1, color: C.redup }}>
              L{i + 1} <Text style={{ fontWeight: "bold", color: C.teks }}>{persen(c, h.terisi)}%</Text>
            </Text>
          ))}
        </View>
        {usulan && <Text style={{ marginTop: 5, color: "#b45309" }}>Sebagian pemetaan masih usulan otomatis dan belum direview HC.</Text>}
      </View>
    </View>
  );
}

function HeaderKolom({ ks, sel, h, nJabatan }: { ks: MatriksKompetensi[]; sel: number; h: Hitung; nJabatan: number }) {
  const grup: [string, number][] = [];
  for (const k of ks) {
    const g = grup.at(-1);
    if (g && g[0] === k.kategori) g[1]++;
    else grup.push([k.kategori, 1]);
  }
  const lebarTeks = TINGGI_NAMA - 6;
  return (
    <View>
      <View style={{ flexDirection: "row", height: TINGGI_KATEGORI }}>
        <View style={{ width: KOL_JABATAN }} />
        {grup.map(([kat, n], i) => (
          <View key={i} style={{ width: n * sel, borderLeftWidth: 0.5, borderColor: C.garis, backgroundColor: C.latar, flexDirection: "row", alignItems: "center", paddingLeft: 3, overflow: "hidden" }}>
            <View style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: KATEGORI_WARNA[kat], marginRight: 3 }} />
            <Text style={{ fontSize: 6, fontWeight: "bold", letterSpacing: 0.6, color: C.redup }}>{n * sel > KATEGORI_LABEL[kat].length * 4.2 + 12 ? KATEGORI_LABEL[kat].toUpperCase() : ""}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", height: TINGGI_NAMA, borderBottomWidth: 0.75, borderColor: C.redup }}>
        <View style={{ width: KOL_JABATAN, justifyContent: "flex-end", paddingBottom: 3 }}>
          <Text style={s.selLabel}>JABATAN</Text>
        </View>
        {ks.map((k) => (
          <View key={k.kode} style={{ width: sel, borderLeftWidth: 0.5, borderColor: C.garis, position: "relative" }}>
            {/* teks diputar -90°: kotak selebar tinggi header, pusatnya di tengah kolom */}
            <View style={{ position: "absolute", width: lebarTeks, height: sel, left: sel / 2 - lebarTeks / 2, top: TINGGI_NAMA / 2 - sel / 2 + 1, transform: "rotate(-90deg)", justifyContent: "center" }}>
              <Text style={{ fontSize: 6, lineHeight: 1 }}>
                <Text style={{ fontWeight: "bold", color: C.brand }}>{k.kode}</Text> {potong(k.nama, NAMA_MAKS)}
              </Text>
            </View>
          </View>
        ))}
        <View style={{ width: KOL_RINGKAS, justifyContent: "flex-end", paddingBottom: 3, paddingLeft: 4 }}>
          <Text style={[s.selLabel, { fontSize: 5.5 }]}>JUMLAH</Text>
          <Text style={[s.selLabel, { fontSize: 5.5 }]}>RATA LV</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", height: TINGGI_DIPAKAI, alignItems: "center", backgroundColor: C.latar, borderBottomWidth: 0.5, borderColor: C.garis }}>
        <Text style={{ width: KOL_JABATAN, paddingLeft: 3, fontSize: 6.5, color: C.redup }}>Dipakai oleh … jabatan</Text>
        {ks.map((k) => {
          const n = h.perKolom.get(k.kode) ?? 0;
          return (
            <Text key={k.kode} style={{ width: sel, textAlign: "center", fontSize: 6, fontWeight: "bold", color: n === nJabatan ? "#b45309" : C.redup }}>
              {n}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function BarisMatriks({ b, d, ks, sel, h }: { b: Baris; d: MatriksDivisi; ks: MatriksKompetensi[]; sel: number; h: Hitung }) {
  if ("unit" in b)
    return (
      <View style={{ height: TINGGI_BARIS, flexDirection: "row", alignItems: "center", backgroundColor: "#eef2f7", paddingLeft: 3, borderBottomWidth: 0.5, borderColor: C.garis }}>
        <Text style={{ fontSize: 6.5, fontWeight: "bold", letterSpacing: 0.5, color: C.navy }}>{b.unit.toUpperCase()}</Text>
      </View>
    );
  const { j } = b;
  const r = h.perBaris.get(j.id);
  const pimpinan = j.jenjang <= 3;
  return (
    <View style={{ height: TINGGI_BARIS, flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderColor: C.garisTipis }}>
      <View style={{ width: KOL_JABATAN, paddingLeft: 3 + (j.jenjang - 1) * 7, paddingRight: 4 }}>
        <Text style={{ fontSize: 7, fontWeight: pimpinan ? "bold" : "normal", color: pimpinan ? C.navy : C.teks, maxLines: 1, textOverflow: "ellipsis" }}>
          {j.nama}
        </Text>
      </View>
      {ks.map((k) => {
        const lv = d.level.get(`${j.id}|${k.kode}`);
        return (
          <View key={k.kode} style={{ width: sel, height: TINGGI_BARIS, padding: 1, borderLeftWidth: 0.5, borderColor: C.garisTipis }}>
            {lv && (
              <Text style={{ flex: 1, paddingTop: 2.5, textAlign: "center", fontSize: 6.5, fontWeight: "bold", backgroundColor: LEVEL_WARNA[lv - 1], color: LEVEL_TEKS[lv - 1], borderRadius: 1 }}>
                {lv}
              </Text>
            )}
          </View>
        );
      })}
      <Text style={{ width: KOL_RINGKAS, paddingLeft: 4, fontSize: 6.5, color: C.redup }}>{r?.n ? `${r.n} · ${des(r.jumlah / r.n)}` : "-"}</Text>
    </View>
  );
}

/** Halaman-halaman satu divisi: kolom dipecah bila tidak muat selebar halaman, baris dipecah bila tidak muat setinggi halaman. */
function HalamanDivisi({ d, sub, usulan, edisi, judul }: { d: MatriksDivisi; sub: string; usulan: boolean; edisi: string; judul: string }) {
  const h = hitung(d);
  const ruangSel = LEBAR - 2 * TEPI - KOL_JABATAN - KOL_RINGKAS;
  const maksKolom = Math.floor(ruangSel / SEL_MIN);
  const bagianKolom: MatriksKompetensi[][] = [];
  for (let i = 0; i < d.kompetensi.length; i += maksKolom) bagianKolom.push(d.kompetensi.slice(i, i + maksKolom));
  if (!bagianKolom.length) bagianKolom.push([]);

  const unitBanyak = new Set(d.jabatan.map((j) => j.unit_nama)).size > 1;
  const baris: Baris[] = [];
  let unitKini: string | null = null;
  for (const j of d.jabatan) {
    if (unitBanyak && j.unit_nama !== unitKini) baris.push({ unit: (unitKini = j.unit_nama) });
    baris.push({ j });
  }
  const ruangTabel = TINGGI - ATAS - BAWAH - TINGGI_JUDUL - TINGGI_KATEGORI - TINGGI_NAMA - TINGGI_DIPAKAI - 10;
  const perHalaman = Math.floor(ruangTabel / TINGGI_BARIS);
  const perHalamanPertama = Math.floor((ruangTabel - TINGGI_RINGKASAN - 8) / TINGGI_BARIS);
  const bagianBaris: Baris[][] = [];
  for (let i = 0; i < baris.length; ) {
    const n = bagianBaris.length === 0 ? perHalamanPertama : perHalaman;
    // judul unit tidak boleh jadi baris terakhir halaman
    let akhir = Math.min(i + n, baris.length);
    if (akhir < baris.length && "unit" in baris[akhir - 1]) akhir--;
    bagianBaris.push(baris.slice(i, akhir));
    i = akhir;
  }

  return (
    <>
      {bagianKolom.flatMap((ks, ci) => {
        const sel = Math.min(SEL_MAKS, Math.floor((ruangSel / Math.max(ks.length, 1)) * 10) / 10);
        return bagianBaris.map((bs, bi) => {
          const bagian = [
            bagianKolom.length > 1 ? ` · kolom bagian ${ci + 1} dari ${bagianKolom.length}` : "",
            bagianBaris.length > 1 ? ` · baris bagian ${bi + 1} dari ${bagianBaris.length}` : "",
          ].join("");
          return (
            <Page key={`${ci}-${bi}`} size="A3" orientation="landscape" style={s.page}>
              <KepalaHalaman judul={judul} />
              <KakiHalaman edisi={edisi} />
              <Judul d={d} sub={sub} bagian={bagian} />
              {ci === 0 && bi === 0 && <Ringkasan d={d} h={h} usulan={usulan} />}
              <HeaderKolom ks={ks} sel={sel} h={h} nJabatan={d.jabatan.length} />
              {bs.map((b, i) => (
                <BarisMatriks key={i} b={b} d={d} ks={ks} sel={sel} h={h} />
              ))}
              {bi === bagianBaris.length - 1 && (
                <Text style={{ marginTop: 8, fontSize: 6.5, color: C.redup }}>
                  Angka di sel = level target kompetensi untuk jabatan tersebut. Kolom kanan = jumlah kompetensi · rata-rata level. Nama jabatan menjorok
                  sesuai jenjang ({[1, 2, 3, 4].map((x) => JENJANG_LABEL[x]).join(", ")}). Angka oranye di baris &quot;Dipakai oleh&quot; = dipakai semua jabatan.
                </Text>
              )}
            </Page>
          );
        });
      })}
    </>
  );
}

export function renderMatriksPdf(divisi: MatriksDivisi[], o: { judul: string; sub: string; usulan: boolean; edisi: string }) {
  return renderToBuffer(
    <Document title={o.judul} author="PT. Bank Pembangunan Daerah Sulawesi Tenggara" subject="Matriks Kompetensi Jabatan" language="id">
      {divisi.map((d) => (
        <HalamanDivisi key={d.divisi} d={d} sub={o.sub} usulan={o.usulan} edisi={o.edisi} judul={o.judul} />
      ))}
    </Document>,
  );
}

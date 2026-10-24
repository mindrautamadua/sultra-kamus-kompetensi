import "server-only";
import path from "node:path";
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { kemiripan, kesenjangan, saranJalur, type Kompetensi, type Profil, type Saran } from "@/lib/kedekatan";
import { JENJANG_LABEL, KATEGORI_LABEL, LEVEL_NAMA } from "@/lib/labels";
import "./font";

// Peta Jalur Karier & Kesenjangan, A3 landscape. Dua bentuk, mengikuti halaman /karier:
// - asal saja: tangga karier lewat garis atasan, saran promosi & rotasi, calon penerus, lalu kesenjangan ke atasan langsung;
// - asal + tujuan: kesenjangan kompetensi dari jabatan asal ke jabatan tujuan.
// Karakter di luar subset latin font (panah, ≥, Σ) dihindari.

const LOGO = path.join(process.cwd(), "public/brand/logo-bank-sultra.png");
const TINGGI = 841.89;
const TEPI = 36;

const C = {
  navy: "#121a42",
  brand: "#1f37b4",
  brandMuda: "#bfd0fd",
  brandRedup: "#8ea6f5",
  amber: "#f59e0b",
  amberMuda: "#fffbeb",
  teks: "#1e293b",
  redup: "#64748b",
  garis: "#e2e8f0",
  latar: "#f8fafc",
  hijau: "#059669",
};
const KATEGORI_WARNA: Record<string, string> = { inti: "#1f37b4", kepemimpinan: "#fbbf24", teknis: "#38bdf8" };
const STATUS = {
  baru: { warna: "#f43f5e", label: "BARU" },
  naik: { warna: "#f59e0b", label: "NAIK LEVEL" },
  memenuhi: { warna: "#10b981", label: "MEMENUHI" },
  lepas: { warna: "#94a3b8", label: "TIDAK DIBUTUHKAN" },
} as const;
const URUT_KATEGORI = ["inti", "kepemimpinan", "teknis"];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const des = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const rataLevel = (p: Profil) => {
  const ks = [...p.kompetensi.values()];
  return ks.length ? ks.reduce((t, k) => t + k.level, 0) / ks.length : 0;
};

const s = StyleSheet.create({
  page: { fontFamily: "Albert Sans", fontSize: 8.5, lineHeight: 1.3, color: C.teks, paddingTop: 66, paddingBottom: 46, paddingHorizontal: TEPI },
  kepala: { position: "absolute", top: 22, left: TEPI, right: TEPI, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottomWidth: 1.5, borderColor: C.amber },
  kepalaLabel: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 1.2, color: C.brand },
  kaki: { position: "absolute", top: TINGGI - 30, left: TEPI, right: TEPI, fontSize: 7, color: C.redup },
  hero: { backgroundColor: C.navy, borderRadius: 6, paddingHorizontal: 22, paddingVertical: 13, color: "#fff", flexDirection: "row", alignItems: "center" },
  label: { fontSize: 6.5, fontWeight: "bold", letterSpacing: 1, color: C.redup },
  judulBagian: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 1.2, color: C.brand, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 0.75, borderColor: C.garis },
  chip: { fontSize: 6.5, fontWeight: "bold", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  ubin: { flex: 1, borderWidth: 0.75, borderColor: C.garis, borderTopWidth: 2.5, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 7, marginRight: 8 },
  ubinNilai: { fontSize: 18, lineHeight: 1.1, fontWeight: "bold", color: C.navy },
  baris: { flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderColor: C.garis, paddingVertical: 2.5, paddingHorizontal: 4 },
  grupBaris: { flexDirection: "row", alignItems: "center", backgroundColor: C.latar, paddingVertical: 3, paddingHorizontal: 4, marginTop: 4 },
  kartu: { borderWidth: 0.75, borderColor: C.garis, borderRadius: 4, padding: 10 },
});

function KepalaHalaman({ sub }: { sub: string }) {
  return (
    <View style={s.kepala} fixed>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, bukan <img> */}
      <Image src={LOGO} style={{ height: 22 }} />
      <View style={{ alignItems: "flex-end" }}>
        <Text style={s.kepalaLabel}>PETA JALUR KARIER & KESENJANGAN KOMPETENSI</Text>
        <Text style={{ fontSize: 7, color: C.redup }}>{sub}</Text>
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

function Catatan() {
  return (
    <Text style={{ marginTop: 10, fontSize: 7, color: C.redup }}>
      Kemiripan = kecocokan profil kompetensi teknis beserta levelnya (jumlah level terkecil dibagi jumlah level terbesar). Kompetensi inti & kepemimpinan
      tidak dihitung dalam kemiripan karena seragam per jenjang, tetapi tetap masuk rincian kesenjangan. Langkah level = total kenaikan level yang
      dibutuhkan (kompetensi baru dihitung dari 0). Selama pemetaan masih usulan otomatis, hasil ini bersifat indikatif.
    </Text>
  );
}

/** Komposisi kategori sebagai batang tipis. */
function Komposisi({ p, latar }: { p: Profil; latar: string }) {
  const ks = [...p.kompetensi.values()];
  return (
    <View style={{ flexDirection: "row", height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: latar, marginTop: 6 }}>
      {URUT_KATEGORI.map((kat) => {
        const n = ks.filter((k) => k.kategori === kat).length;
        return n > 0 && <View key={kat} style={{ flex: n, backgroundColor: KATEGORI_WARNA[kat] }} />;
      })}
    </View>
  );
}

function ProfilGelap({ p, judul, kanan = false }: { p: Profil; judul: string; kanan?: boolean }) {
  return (
    <View style={{ alignItems: kanan ? "flex-end" : "flex-start" }}>
      <Text style={{ fontSize: 7, fontWeight: "bold", letterSpacing: 1.2, color: C.amber }}>{judul}</Text>
      <Text style={{ fontSize: 17, lineHeight: 1.2, fontWeight: "bold", marginTop: 3, textAlign: kanan ? "right" : "left" }}>{p.nama}</Text>
      <Text style={{ fontSize: 8.5, color: C.brandMuda, marginTop: 2, textAlign: kanan ? "right" : "left" }}>
        {p.kode} · {p.unitInduk} · {JENJANG_LABEL[p.jenjang]}
      </Text>
      <View style={{ width: 220 }}>
        <Komposisi p={p} latar="#ffffff22" />
      </View>
      <Text style={{ fontSize: 7.5, color: C.brandRedup, marginTop: 3 }}>
        {p.kompetensi.size} kompetensi · rata-rata L{des(rataLevel(p))}
      </Text>
    </View>
  );
}

function Ubin({ label, nilai, ket, warna }: { label: string; nilai: string; ket: string; warna: string }) {
  return (
    <View style={[s.ubin, { borderTopColor: warna }]}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.ubinNilai}>{nilai}</Text>
      <Text style={{ fontSize: 7, color: C.redup, marginTop: 2 }}>{ket}</Text>
    </View>
  );
}

const SKALA = 180;

type Status = Exclude<keyof typeof STATUS, "lepas">;

/** Level asal (lingkaran kosong) dan tujuan (lingkaran penuh) pada skala 0–5, dihubungkan batang. */
function Dumbbell({ dari, ke, status }: { dari: number; ke: number; status: Status }) {
  const x = (lv: number) => (lv / 5) * SKALA;
  const kiri = Math.min(dari, ke);
  const kanan = Math.max(dari, ke);
  const w = STATUS[status].warna;
  return (
    <View style={{ width: SKALA + 8, height: 10, position: "relative", marginHorizontal: 4 }}>
      <View style={{ position: "absolute", left: 4, width: SKALA, top: 4.5, height: 1, backgroundColor: C.garis }} />
      {[0, 1, 2, 3, 4, 5].map((l) => (
        <View key={l} style={{ position: "absolute", left: 4 + x(l) - 0.25, top: 2, width: 0.5, height: 6, backgroundColor: C.garis }} />
      ))}
      {kanan > kiri && <View style={{ position: "absolute", left: 4 + x(kiri), width: x(kanan) - x(kiri), top: 3, height: 4, borderRadius: 2, backgroundColor: w, opacity: 0.35 }} />}
      {status !== "baru" && (
        <View style={{ position: "absolute", left: 4 + x(dari) - 4, top: 1, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C.redup, backgroundColor: "#fff" }} />
      )}
      <View style={{ position: "absolute", left: 4 + x(ke) - 4, top: 1, width: 8, height: 8, borderRadius: 4, backgroundColor: w }} />
    </View>
  );
}

type BarisGap = { k: Kompetensi; dari: number; ke: number; status: Status };

function TabelKesenjangan({ asal, tujuan }: { asal: Profil; tujuan: Profil }) {
  const g = kesenjangan(asal, tujuan);
  const baris: BarisGap[] = [
    ...g.baru.map((k) => ({ k, dari: 0, ke: k.level, status: "baru" as const })),
    ...g.naik.map((k) => ({ k, dari: k.dari, ke: k.level, status: "naik" as const })),
    ...g.memenuhi.map((k) => ({ k, dari: k.dari, ke: k.level, status: "memenuhi" as const })),
  ];
  return (
    <View>
      <Text style={s.judulBagian}>PETA KESENJANGAN LEVEL</Text>
      <View style={{ flexDirection: "row", alignItems: "center", fontSize: 6.5, fontWeight: "bold", color: C.redup, paddingHorizontal: 4, paddingBottom: 3 }}>
        <Text style={{ width: 58 }}>KODE</Text>
        <Text style={{ flex: 1 }}>KOMPETENSI</Text>
        <View style={{ width: SKALA + 16, flexDirection: "row", paddingLeft: 4 }}>
          {[0, 1, 2, 3, 4, 5].map((l) => (
            <Text key={l} style={{ position: "absolute", left: 8 + (l / 5) * SKALA - 4, width: 8, textAlign: "center" }}>
              {l}
            </Text>
          ))}
        </View>
        <Text style={{ width: 92 }}>STATUS</Text>
        <Text style={{ width: 120 }}>LEVEL</Text>
        <Text style={{ width: 34, textAlign: "right" }}>SELISIH</Text>
      </View>
      {URUT_KATEGORI.map((kat) => {
        const rs = baris.filter((b) => b.k.kategori === kat);
        if (!rs.length) return null;
        return (
          <View key={kat}>
            <View style={s.grupBaris} minPresenceAhead={30}>
              <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: KATEGORI_WARNA[kat], marginRight: 5 }} />
              <Text style={{ fontSize: 7, fontWeight: "bold", letterSpacing: 0.8, color: C.redup }}>
                KOMPETENSI {KATEGORI_LABEL[kat].toUpperCase()} · {rs.length}
              </Text>
            </View>
            {rs.map((b) => {
              const selisih = Math.max(0, b.ke - b.dari);
              return (
                <View key={b.k.kode} style={s.baris} wrap={false}>
                  <Text style={{ width: 58, fontSize: 7.5, color: C.redup }}>{b.k.kode}</Text>
                  <Text style={{ flex: 1, paddingRight: 8 }}>{b.k.nama}</Text>
                  <Dumbbell dari={b.dari} ke={b.ke} status={b.status} />
                  <View style={{ width: 92 }}>
                    <Text style={[s.chip, { alignSelf: "flex-start", color: "#fff", backgroundColor: STATUS[b.status].warna }]}>{STATUS[b.status].label}</Text>
                  </View>
                  <Text style={{ width: 120, color: C.redup }}>
                    {b.status === "baru" ? `belum ada, target L${b.ke} ${LEVEL_NAMA[b.ke - 1]}` : `L${b.dari} menjadi L${b.ke} ${LEVEL_NAMA[b.ke - 1]}`}
                  </Text>
                  <Text style={{ width: 34, textAlign: "right", fontWeight: "bold", color: selisih ? "#b45309" : C.redup }}>{selisih ? `+${selisih}` : "-"}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, fontSize: 7, color: C.redup }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C.redup, marginRight: 3 }} />
        <Text style={{ marginRight: 12 }}>level jabatan asal</Text>
        {(["baru", "naik", "memenuhi"] as const).map((st) => (
          <View key={st} style={{ flexDirection: "row", alignItems: "center", marginRight: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS[st].warna, marginRight: 3 }} />
            <Text>level target jabatan tujuan ({STATUS[st].label.toLowerCase()})</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Kesenjangan asal ke tujuan: hero dari-ke, angka ringkas, fokus pengembangan, lalu tabel lengkap. */
function BagianKesenjangan({ asal, tujuan, judul }: { asal: Profil; tujuan: Profil; judul?: string }) {
  const g = kesenjangan(asal, tujuan);
  const arah = tujuan.jenjang < asal.jenjang ? "PROMOSI" : tujuan.jenjang === asal.jenjang ? "ROTASI" : "KE JENJANG LEBIH RENDAH";
  const dibutuhkan = tujuan.kompetensi.size;
  const siap = dibutuhkan ? g.memenuhi.length / dibutuhkan : 0;
  const fokus = [...g.baru.map((k) => ({ k, dari: 0 })), ...g.naik.map((k) => ({ k, dari: k.dari }))]
    .sort((a, b) => b.k.level - b.dari - (a.k.level - a.dari))
    .slice(0, 6);
  return (
    <View>
      {judul && <Text style={[s.judulBagian, { fontSize: 9 }]}>{judul}</Text>}
      <View style={s.hero} wrap={false}>
        <View style={{ flex: 1 }}>
          <ProfilGelap p={asal} judul="DARI" />
        </View>
        <View style={{ width: 210, alignItems: "center" }}>
          <Text style={[s.chip, { backgroundColor: C.amber, color: C.navy }]}>{arah}</Text>
          <Text style={{ fontSize: 30, lineHeight: 1.1, fontWeight: "bold", marginTop: 4 }}>{pct(siap)}</Text>
          <Text style={{ fontSize: 7, letterSpacing: 1, color: C.brandMuda }}>SIAP ({g.memenuhi.length} DARI {dibutuhkan} KOMPETENSI)</Text>
          <Text style={{ fontSize: 8, color: C.brandMuda, marginTop: 4 }}>
            kemiripan teknis <Text style={{ fontWeight: "bold", color: "#fff" }}>{pct(g.kemiripan)}</Text>
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <ProfilGelap p={tujuan} judul="KE" kanan />
        </View>
      </View>

      <View style={{ flexDirection: "row", marginTop: 10, marginRight: -8 }} wrap={false}>
        <Ubin label="SUDAH MEMENUHI" nilai={`${g.memenuhi.length}/${dibutuhkan}`} ket="kompetensi jabatan tujuan" warna={C.hijau} />
        <Ubin label="KOMPETENSI BARU" nilai={String(g.baru.length)} ket={g.baru.length ? "belum dimiliki sama sekali" : "tidak ada"} warna={STATUS.baru.warna} />
        <Ubin label="HARUS NAIK LEVEL" nilai={String(g.naik.length)} ket={g.naik.length ? "dimiliki, level belum cukup" : "tidak ada"} warna={STATUS.naik.warna} />
        <Ubin label="TOTAL LANGKAH LEVEL" nilai={String(g.langkah)} ket="kenaikan level yang dibutuhkan" warna={C.navy} />
        <Ubin label="TIDAK DIBUTUHKAN LAGI" nilai={String(g.lepas.length)} ket="kompetensi asal di luar profil tujuan" warna={STATUS.lepas.warna} />
      </View>

      <View style={{ flexDirection: "row", marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <TabelKesenjangan asal={asal} tujuan={tujuan} />
        </View>
        <View style={{ width: 250, marginLeft: 16 }}>
          <Text style={s.judulBagian}>FOKUS PENGEMBANGAN</Text>
          {fokus.length === 0 ? (
            <Text style={{ color: C.hijau }}>Semua kompetensi jabatan tujuan sudah terpenuhi.</Text>
          ) : (
            fokus.map(({ k, dari }, i) => (
              <View key={k.kode} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6 }} wrap={false}>
                <Text style={{ width: 16, height: 16, borderRadius: 8, paddingTop: 3, textAlign: "center", fontSize: 7.5, fontWeight: "bold", backgroundColor: C.amberMuda, color: "#92400e", marginRight: 6 }}>
                  {i + 1}
                </Text>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <Text style={{ fontWeight: "bold" }}>{k.nama}</Text>
                  <Text style={{ fontSize: 7.5, color: C.redup }}>
                    {k.kode} · {dari ? `L${dari} menjadi L${k.level}` : `baru, sampai L${k.level} ${LEVEL_NAMA[k.level - 1]}`}
                  </Text>
                </View>
                <Text style={{ fontWeight: "bold", color: "#b45309" }}>+{k.level - dari}</Text>
              </View>
            ))
          )}
          <Text style={{ fontSize: 7.5, color: C.redup, marginTop: 2 }}>
            Diurutkan dari selisih level terbesar. Gunakan sebagai prioritas program pengembangan (pelatihan, penugasan, coaching) sebelum promosi atau rotasi.
          </Text>
          {g.lepas.length > 0 && (
            <View style={{ marginTop: 10 }} wrap={false}>
              <Text style={s.judulBagian}>TIDAK DIBUTUHKAN LAGI · {g.lepas.length}</Text>
              {g.lepas.map((k) => (
                <View key={k.kode} style={{ flexDirection: "row", marginBottom: 3 }}>
                  <Text style={{ flex: 1, color: C.redup, paddingRight: 6 }}>
                    <Text style={{ fontSize: 7.5 }}>{k.kode}</Text> {k.nama}
                  </Text>
                  <Text style={{ color: C.redup }}>L{k.level}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function DaftarSaran({ judul, saran, kosong }: { judul: string; saran: Saran[]; kosong: string }) {
  const maks = Math.max(1, ...saran.map((x) => x.langkah));
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.judulBagian}>{judul}</Text>
      {saran.length === 0 ? (
        <Text style={{ color: C.redup }}>{kosong}</Text>
      ) : (
        <>
          <View style={{ flexDirection: "row", fontSize: 6.5, fontWeight: "bold", color: C.redup, paddingHorizontal: 4, paddingBottom: 3 }}>
            <Text style={{ flex: 1 }}>JABATAN</Text>
            <Text style={{ width: 110 }}>KEMIRIPAN TEKNIS</Text>
            <Text style={{ width: 90 }}>LANGKAH LEVEL</Text>
          </View>
          {saran.map((x) => (
            <View key={x.p.id} style={s.baris} wrap={false}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontWeight: "bold" }}>{x.p.nama}</Text>
                <Text style={{ fontSize: 7, color: x.alasan === "atasan langsung" ? C.brand : C.redup }}>
                  {x.alasan === "atasan langsung" ? `ATASAN LANGSUNG · ${x.p.unitInduk}` : x.p.unitInduk}
                </Text>
              </View>
              <Meter v={x.kemiripan} lebar={70} />
              <View style={{ width: 90, flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 60, height: 4, borderRadius: 2, backgroundColor: C.garis, overflow: "hidden" }}>
                  <View style={{ width: (x.langkah / maks) * 60, height: 4, backgroundColor: C.amber }} />
                </View>
                <Text style={{ marginLeft: 6, fontWeight: "bold" }}>{x.langkah}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function Meter({ v, lebar }: { v: number; lebar: number }) {
  return (
    <View style={{ width: lebar + 40, flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: lebar, height: 4, borderRadius: 2, backgroundColor: C.garis, overflow: "hidden" }}>
        <View style={{ width: v * lebar, height: 4, backgroundColor: C.brand }} />
      </View>
      <Text style={{ marginLeft: 6, fontSize: 7.5, color: C.redup }}>{pct(v)}</Text>
    </View>
  );
}

/** Rantai atasan langsung sampai puncak, dengan langkah per anak tangga (sama dengan halaman /karier). */
function tanggaKarier(asal: Profil, semua: Map<number, Profil>) {
  const tangga: { p: Profil; langkah: number; kumulatif: number }[] = [];
  let kini = asal;
  let total = 0;
  const dilihat = new Set([asal.id]);
  while (kini.atasanId && semua.has(kini.atasanId) && !dilihat.has(kini.atasanId)) {
    const naik = semua.get(kini.atasanId)!;
    dilihat.add(naik.id);
    const l = naik.kompetensi.size ? kesenjangan(kini, naik).langkah : 0;
    total += l;
    tangga.push({ p: naik, langkah: l, kumulatif: total });
    kini = naik;
  }
  return tangga;
}

function PetaJalur({ asal, semua }: { asal: Profil; semua: Map<number, Profil> }) {
  const { promosi, rotasi } = saranJalur(asal, semua);
  const tangga = tanggaKarier(asal, semua);
  const penerus = [...semua.values()]
    .filter((p) => p.jenjang === asal.jenjang + 1 && p.kompetensi.size > 0)
    .map((p) => ({ p, v: kemiripan(p, asal), langkah: kesenjangan(p, asal).langkah, langsung: p.atasanId === asal.id }))
    .sort((a, b) => Number(b.langsung) - Number(a.langsung) || b.v - a.v)
    .slice(0, 6);

  return (
    <View>
      <View style={s.hero} wrap={false}>
        <View style={{ width: 330, paddingRight: 20 }}>
          <ProfilGelap p={asal} judul="JABATAN ASAL" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 7, fontWeight: "bold", letterSpacing: 1.2, color: C.amber, marginBottom: 6 }}>TANGGA KARIER LEWAT GARIS ATASAN</Text>
          {tangga.length === 0 ? (
            <Text style={{ color: C.brandMuda }}>Tidak ada atasan dengan pemetaan kompetensi di atas jabatan ini.</Text>
          ) : (
            <>
              {[...tangga].reverse().map((t, i) => (
                <View
                  key={t.p.id}
                  style={{ flexDirection: "row", alignItems: "center", marginLeft: (tangga.length - 1 - i) * 18, marginBottom: 4, backgroundColor: "#ffffff12", borderRadius: 4, paddingHorizontal: 9, paddingVertical: 5 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "bold" }}>{t.p.nama}</Text>
                    <Text style={{ fontSize: 7, color: C.brandRedup }}>{JENJANG_LABEL[t.p.jenjang]}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 7.5, color: C.brandMuda }}>+{t.langkah} langkah</Text>
                    <Text style={{ fontSize: 7.5, fontWeight: "bold", color: C.amber }}>total {t.kumulatif}</Text>
                  </View>
                </View>
              ))}
              <View style={{ marginLeft: tangga.length * 18, backgroundColor: C.amber, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 5 }}>
                <Text style={{ fontWeight: "bold", color: C.navy }}>{asal.nama} · posisi sekarang</Text>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={{ flexDirection: "row", marginTop: 16 }} wrap={false}>
        <DaftarSaran
          judul={`PROMOSI · ${asal.jenjang > 1 ? JENJANG_LABEL[asal.jenjang - 1].toUpperCase() : "JENJANG TERTINGGI"}`}
          saran={promosi}
          kosong="Tidak ada jabatan satu jenjang di atas."
        />
        <View style={{ width: 20 }} />
        <DaftarSaran judul="ROTASI · JABATAN SEJENJANG DI UNIT LAIN" saran={rotasi} kosong="Tidak ada jabatan sejenjang dengan profil kompetensi yang bisa dibandingkan." />
      </View>

      {asal.jenjang < 4 && (
        <View style={{ marginTop: 16 }} wrap={false}>
          <Text style={s.judulBagian}>CALON PENERUS · JABATAN SATU JENJANG DI BAWAH YANG PALING SIAP</Text>
          {penerus.length === 0 ? (
            <Text style={{ color: C.redup }}>Tidak ada jabatan di jenjang bawahnya.</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginRight: -8 }}>
              {penerus.map(({ p, v, langkah, langsung }) => (
                <View key={p.id} style={[s.kartu, { width: "31.6%", marginRight: 8, marginBottom: 8 }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ flex: 1, fontWeight: "bold", paddingRight: 6 }}>{p.nama}</Text>
                    {langsung && <Text style={[s.chip, { alignSelf: "flex-start", backgroundColor: "#eef3ff", color: C.brand }]}>BAWAHAN LANGSUNG</Text>}
                  </View>
                  <Text style={{ fontSize: 7, color: C.redup, marginBottom: 5 }}>{p.unitInduk}</Text>
                  <Meter v={v} lebar={150} />
                  <Text style={{ fontSize: 7.5, color: C.redup, marginTop: 3 }}>
                    <Text style={{ fontWeight: "bold", color: C.teks }}>{langkah}</Text> langkah level menuju jabatan ini
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      <Catatan />
    </View>
  );
}

export type DokumenKarier = { asal: Profil; tujuan?: Profil; semua: Map<number, Profil> };

function Halaman({ d, edisi }: { d: DokumenKarier; edisi: string }) {
  const { asal, tujuan, semua } = d;
  const atasan = asal.atasanId ? semua.get(asal.atasanId) : undefined;
  const sub = tujuan ? `${asal.nama} ke ${tujuan.nama}` : asal.nama;
  return (
    <>
      <Page size="A3" orientation="landscape" style={s.page}>
        <KepalaHalaman sub={sub} />
        <KakiHalaman edisi={edisi} />
        {tujuan ? (
          <>
            <BagianKesenjangan asal={asal} tujuan={tujuan} />
            <Catatan />
          </>
        ) : (
          <PetaJalur asal={asal} semua={semua} />
        )}
      </Page>
      {!tujuan && atasan && atasan.kompetensi.size > 0 && (
        <Page size="A3" orientation="landscape" style={s.page}>
          <KepalaHalaman sub={`${asal.nama} ke ${atasan.nama}`} />
          <KakiHalaman edisi={edisi} />
          <BagianKesenjangan asal={asal} tujuan={atasan} judul="KESENJANGAN MENUJU ATASAN LANGSUNG" />
        </Page>
      )}
    </>
  );
}

export function renderKarierPdf(docs: DokumenKarier[], judul: string, edisi: string) {
  return renderToBuffer(
    <Document title={judul} author="PT. Bank Pembangunan Daerah Sulawesi Tenggara" subject="Peta Jalur Karier & Kesenjangan Kompetensi" language="id">
      {docs.map((d, i) => (
        <Halaman key={i} d={d} edisi={edisi} />
      ))}
    </Document>,
  );
}

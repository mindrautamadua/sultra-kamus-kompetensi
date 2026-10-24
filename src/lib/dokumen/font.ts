import path from "node:path";
import { Font } from "@react-pdf/renderer";

// Font tertanam di PDF agar tampil sama di semua penampil.
// Albert Sans menggantikan FS Albert (font jobdesk asli, berlisensi); Tinos setara metrik Times New Roman (kamus).
const dir = (pkg: string) => path.join(process.cwd(), "node_modules/@fontsource", pkg, "files");

for (const [family, pkg] of [
  ["Albert Sans", "albert-sans"],
  ["Tinos", "tinos"],
] as const) {
  Font.register({
    family,
    fonts: [400, 700].flatMap((w) =>
      (["normal", "italic"] as const).map((style) => ({
        src: path.join(dir(pkg), `${pkg}-latin-${w}-${style}.woff`),
        fontWeight: w,
        fontStyle: style,
      })),
    ),
  });
}

// Tanpa pemenggalan kata otomatis (aturan bawaan memakai pola bahasa Inggris, mis. "peruba-han").
Font.registerHyphenationCallback((word) => [word]);

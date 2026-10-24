// Menu utama aplikasi: dipakai sidebar (nav.tsx) dan tile akses cepat di halaman Ringkasan.
// 20x20 outline icons (path data), shown alone when the sidebar is collapsed
import { PENILAIAN_DIRI_AKTIF } from "@/lib/fitur";

const SEMUA = [
  { href: "/", label: "Ringkasan", icon: "M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM11.5 11.5h5v5h-5z" },
  { href: "/kompetensi", label: "Kamus Kompetensi", icon: "M4 3.5h9.5a2 2 0 0 1 2 2v11H6a2 2 0 0 1-2-2zM4 14.5a2 2 0 0 1 2-2h9.5M7.5 7h5" },
  { href: "/penilaian-diri", label: "Penilaian Diri", icon: "M4.5 5.5l1.5 1.5 2.5-3M4.5 11l1.5 1.5 2.5-3M11 5.5h5M11 11h5M4.5 16h11.5" },
  { href: "/jabatan", label: "Daftar Jabatan", icon: "M7.5 3.5h5v4h-5zM3 13h5v3.5H3zM12 13h5v3.5h-5zM10 7.5V10M5.5 13v-3h9v3" },
  { href: "/matriks", label: "Matriks Kompetensi", icon: "M3.5 3.5h13v13h-13zM3.5 8h13M3.5 12.5h13M8 3.5v13M12.5 3.5v13" },
  { href: "/karier", label: "Jalur Karier", icon: "M4 16V12h4V8h4V4h4M13 4h3v3" },
  { href: "/review", label: "Progres Review", icon: "M4 4.5h12M4 10h7M4 15.5h5M13 14l2 2 3.5-4" },
  { href: "/kualitas", label: "Kualitas Pemetaan", icon: "M10 2.5 4 5v4.5c0 3.6 2.5 6.6 6 8 3.5-1.4 6-4.4 6-8V5zM7.5 10l2 2 3.5-4" },
  { href: "/analisa", label: "Analisa Data", icon: "M3.5 16.5h13M6 13.5V9M10 13.5V5M14 13.5v-6" },
  { href: "/panduan", label: "Panduan Pengguna", icon: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8 8a2 2 0 1 1 2.5 1.9c-.3.1-.5.4-.5.8V11M10 13.5v.5" },
] as const;

export const MENU = SEMUA.filter((m) => PENILAIAN_DIRI_AKTIF || m.href !== "/penilaian-diri");

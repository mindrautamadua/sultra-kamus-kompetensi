import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "@fontsource-variable/lexend";
import "@fontsource-variable/source-sans-3";
import { SIDEBAR_INIT } from "@/lib/sidebar";
import "./globals.css";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Kamus Kompetensi — Bank Sultra", template: "%s · Kamus Kompetensi" },
  description: "Kamus kompetensi, struktur jabatan, dan pemetaan kompetensi jabatan Bank Sultra.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT }} />
      </head>
      <body className="min-h-full bg-slate-100/70 text-[15px] text-slate-800">
        {children}
      </body>
    </html>
  );
}

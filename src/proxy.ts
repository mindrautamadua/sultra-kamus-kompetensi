import { NextResponse, type NextRequest } from "next/server";
import { bacaToken, COOKIE_SESI } from "@/lib/sesi";
import { sesiBerlaku } from "@/lib/sesi-berlaku";

// Gerbang semua halaman, PDF, dan unduhan: tanda tangan & masa berlaku cookie sesi, lalu apakah sesi itu sudah
// dicabut (akun dinonaktifkan / password diganti) — lihat src/lib/sesi-berlaku.ts.
// Server Actions tetap memeriksa ulang lewat wajibLogin() (src/lib/auth.ts).
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = await bacaToken(request.cookies.get(COOKIE_SESI)?.value);
  const sesi = token && (await sesiBerlaku(token)) ? token : null;
  // cookie bertanda tangan sah tapi sudah dicabut: hapus agar halaman login bisa dibuka lagi
  const bersihkan = (res: NextResponse) => {
    if (token && !sesi) res.cookies.delete(COOKIE_SESI);
    return res;
  };

  if (pathname === "/login") {
    return sesi ? NextResponse.redirect(new URL("/", request.url)) : bersihkan(NextResponse.next());
  }
  if (sesi) return NextResponse.next();

  // PDF & unduhan CSV juga dilindungi; permintaan non-halaman cukup ditolak
  if (request.method !== "GET" || request.headers.get("next-action")) {
    return bersihkan(new NextResponse("Sesi berakhir, silakan login ulang.", { status: 401 }));
  }
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("dari", pathname + search);
  return bersihkan(NextResponse.redirect(url));
}

export const config = {
  // semua kecuali aset statis Next dan file publik
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp)$).*)"],
};

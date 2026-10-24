import { NextResponse, type NextRequest } from "next/server";
import { bacaToken, COOKIE_SESI } from "@/lib/sesi";

// Pemeriksaan optimistis: tanda tangan & masa berlaku cookie sesi, tanpa database.
// Server Actions tetap memeriksa ulang lewat wajibLogin() (src/lib/auth.ts).
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sesi = await bacaToken(request.cookies.get(COOKIE_SESI)?.value);

  if (pathname === "/login") {
    return sesi ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (sesi) return NextResponse.next();

  // PDF & unduhan CSV juga dilindungi; permintaan non-halaman cukup ditolak
  if (request.method !== "GET" || request.headers.get("next-action")) {
    return new NextResponse("Sesi berakhir, silakan login ulang.", { status: 401 });
  }
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("dari", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // semua kecuali aset statis Next dan file publik
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp)$).*)"],
};

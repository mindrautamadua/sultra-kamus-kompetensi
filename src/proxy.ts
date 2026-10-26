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

  // PDF & unduhan Excel juga dilindungi; permintaan non-halaman cukup ditolak. content-type harus persis
  // "text/plain" agar klien Server Action meneruskan pesan ini (ActionForm menampilkannya tanpa membuang isian form).
  if (request.method !== "GET" || request.headers.get("next-action")) {
    return bersihkan(
      new NextResponse("Sesi login berakhir. Login ulang di tab baru, lalu simpan lagi di sini — isian Anda belum hilang.", {
        status: 401,
        headers: { "content-type": "text/plain" },
      }),
    );
  }
  const url = new URL("/login", request.url);
  if (pathname !== "/") url.searchParams.set("dari", pathname + search);
  return bersihkan(NextResponse.redirect(url));
}

export const config = {
  // semua kecuali aset statis Next dan file publik
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp)$).*)"],
};

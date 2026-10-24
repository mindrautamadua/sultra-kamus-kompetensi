import "server-only";

/** PDF ditampilkan langsung di penampil PDF browser; ?unduh=1 memaksa unduhan. */
export function responPdf(buf: Buffer, namaFile: string, unduh: boolean) {
  const nama = namaFile.replace(/[^\w.\- ]+/g, "-").replace(/\s+/g, " ").trim();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${unduh ? "attachment" : "inline"}; filename="${nama}"; filename*=UTF-8''${encodeURIComponent(nama)}`,
      "Cache-Control": "no-store",
    },
  });
}

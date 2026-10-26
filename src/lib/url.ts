/**
 * Kode dari parameter rute ([kode], [bidang]). decodeURIComponent melempar URIError bila nilainya sudah ter-decode
 * dan memuat "%" (mis. "50%"); dalam hal itu nilai apa adanya yang dipakai, bukan galat 500.
 */
export function kodeRute(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

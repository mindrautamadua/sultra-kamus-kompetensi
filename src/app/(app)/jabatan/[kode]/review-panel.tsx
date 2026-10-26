import { ActionForm } from "@/components/editors";
import { Card, ReviewBadge } from "@/components/ui";
import { ubahStatusReview } from "@/lib/actions";
import { penggunaSaatIni } from "@/lib/auth";
import { REVIEW_LABEL } from "@/lib/labels";
import { statusTujuan } from "@/lib/peran";
import { must, supabase } from "@/lib/supabase";

const AKSI: Record<string, string> = {
  ubah_status: "mengubah status",
  simpan_jobdesk: "menyimpan jobdesk",
  simpan_kompetensi: "menyimpan kompetensi",
  simpan_jabatan: "menyimpan data jabatan",
  buat_jabatan: "membuat jabatan",
  selesai_massal: "menandai selesai (massal)",
};
const PENJELASAN: Record<string, string> = {
  draf: "Masih dikerjakan konsultan.",
  selesai: "Pemetaan sudah final dan siap diserahkan ke Divisi HC.",
};
// label tombol menurut tujuan
const AKSI_STATUS: Record<string, string> = {
  draf: "Buka kembali ke draf",
  selesai: "Tandai selesai",
};

/** Mengapa tidak ada aksi status untuk peran ini. */
function keterangan(status: string) {
  return status === "selesai"
    ? "Sudah selesai. Bila jobdesk atau kompetensinya diedit, status otomatis kembali ke Draf."
    : "Status diubah oleh konsultan (editor). Peran akun Anda hanya dapat melihat.";
}

const waktu = (s: string) => new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }) // WITA, sama dengan Progres Review;

/** Review status of one jabatan: current status, change form, and history timeline. */
export async function ReviewPanel({ jabatanId }: { jabatanId: number }) {
  const [review, riwayat, saya] = await Promise.all([
    supabase.from("review_jabatan").select("status, peninjau, catatan, updated_at").eq("jabatan_id", jabatanId).maybeSingle().then(must),
    supabase
      .from("review_riwayat")
      .select("id, aksi, status_dari, status_ke, peninjau, catatan, created_at")
      .eq("jabatan_id", jabatanId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(must),
    penggunaSaatIni(),
  ]);
  const status = review?.status ?? "draf";
  const tujuan = statusTujuan(saya?.peran, status);
  // sisa jabatan draf lain, untuk opsi "lanjut ke berikutnya" setelah menandai selesai
  const sisaAntrean = tujuan.includes("selesai")
    ? ((await supabase.from("v_review_jabatan").select("jabatan_id", { count: "exact", head: true }).eq("status", status).neq("jabatan_id", jabatanId)).count ?? 0)
    : 0;

  return (
    <Card title="Status review" action={<ReviewBadge status={status} />}>
      <div id="review" className="grid grid-cols-1 scroll-mt-6 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="space-y-3 p-4">
          <p className="text-sm text-slate-600">
            <b className="text-slate-900">{REVIEW_LABEL[status]}</b> — {PENJELASAN[status]}
            {review?.peninjau && (
              <>
                {" "}
                Terakhir oleh <b className="text-slate-800">{review.peninjau}</b>, {waktu(review.updated_at)}.
              </>
            )}
          </p>
          {review?.catatan && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">{review.catatan}</p>}
          {tujuan.length ? (
            <ActionForm action={ubahStatusReview} submit={AKSI_STATUS[tujuan[0]]}>
              <input type="hidden" name="jabatan_id" value={jabatanId} />
              <input type="hidden" name="status" value={tujuan[0]} />
              <label className="field-label">
                Catatan (opsional)
                <textarea name="catatan" rows={2} className="field h-auto py-2" placeholder={tujuan[0] === "selesai" ? "mis. level FTM-05 disesuaikan dengan jenjang" : "alasan dibuka kembali"} />
              </label>
              {sisaAntrean > 0 && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="hidden" name="antrean" value={status} />
                  <input type="checkbox" name="lanjut" defaultChecked className="accent-brand-700" />
                  Setelah ditandai selesai, buka jabatan draf berikutnya ({sisaAntrean} lagi)
                </label>
              )}
              <p className="text-xs text-slate-500">Tercatat atas nama {saya?.nama}.</p>
            </ActionForm>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">{keterangan(status)}</p>
          )}
        </div>
        <div className="p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Riwayat</h3>
          {riwayat.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada aktivitas. Pemetaan masih draf otomatis hasil impor dokumen.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {riwayat.map((r) => (
                <li key={r.id} className="text-sm">
                  <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-white bg-brand-500" aria-hidden />
                  <div className="text-slate-800">
                    <b>{r.peninjau ?? "Tanpa nama"}</b> {AKSI[r.aksi] ?? r.aksi}
                    {r.status_ke && r.status_dari !== r.status_ke && (
                      <>
                        {" "}
                        · <ReviewBadge status={r.status_dari} /> → <ReviewBadge status={r.status_ke} />
                      </>
                    )}
                  </div>
                  {r.catatan && <div className="mt-0.5 text-slate-600">{r.catatan}</div>}
                  <div className="text-xs text-slate-500">{waktu(r.created_at)}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
  );
}

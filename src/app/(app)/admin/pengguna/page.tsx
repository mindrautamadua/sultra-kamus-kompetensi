import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/editors";
import { ListSkeleton } from "@/components/skeleton";
import { Card } from "@/components/ui";
import { wajibLogin } from "@/lib/auth";
import { resetPasswordPengguna, tambahPengguna, ubahPengguna } from "@/lib/pengguna-actions";
import { bolehKelolaAkun, PERAN, PERAN_LABEL, PERAN_PENJELASAN } from "@/lib/peran";
import { admin, ok } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: "Pengguna" };

const waktu = (s: string | null) => (s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "belum pernah");

export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat daftar pengguna" fields={0} columns={1} rows={6} />}>
      <Daftar />
    </Suspense>
  );
}

async function Daftar() {
  const saya = await wajibLogin();
  if (!bolehKelolaAkun(saya.peran)) redirect("/");
  const rows = ok(
    await admin().from("pengguna").select("id, username, nama, peran, aktif, terakhir_login, terkunci_sampai").order("aktif", { ascending: false }).order("username"),
  );

  return (
    <div className="space-y-6">
      <Card title="Hak tiap peran">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
          {PERAN.map((p) => (
            <div key={p}>
              <dt className="font-semibold text-slate-900">{PERAN_LABEL[p]}</dt>
              <dd className="text-slate-600">{PERAN_PENJELASAN[p]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title={`Akun (${rows.length})`}>
        <ul className="divide-y divide-slate-100">
          {rows.map((u) => {
            const terkunci = u.terkunci_sampai && new Date(u.terkunci_sampai) > new Date();
            return (
              <li key={u.id} className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${u.aktif ? "text-slate-900" : "text-slate-400 line-through"}`}>{u.nama}</span>
                    <span className="font-mono text-xs text-slate-500">{u.username}</span>
                    {u.id === saya.id && <span className="rounded-full bg-brand-50 px-2 text-xs font-medium text-brand-700 ring-1 ring-brand-200">Anda</span>}
                    {terkunci && <span className="rounded-full bg-rose-50 px-2 text-xs font-medium text-rose-700 ring-1 ring-rose-200">terkunci</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">Login terakhir: {waktu(u.terakhir_login)}</div>
                </div>
                <ActionForm action={ubahPengguna} submit="Simpan" className="lg:w-80">
                  <input type="hidden" name="id" value={u.id} />
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="field-label min-w-36 flex-1">
                      Peran
                      <select name="peran" defaultValue={u.peran} className="field" disabled={u.id === saya.id}>
                        {PERAN.map((p) => (
                          <option key={p} value={p}>
                            {PERAN_LABEL[p]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="aktif" defaultChecked={u.aktif} disabled={u.id === saya.id} className="accent-brand-700" />
                      Aktif
                    </label>
                  </div>
                  {/* field disabled tidak ikut terkirim; kirim nilai sekarang agar akun sendiri tetap valid */}
                  {u.id === saya.id && (
                    <>
                      <input type="hidden" name="peran" value={u.peran} />
                      <input type="hidden" name="aktif" value="on" />
                    </>
                  )}
                </ActionForm>
                <ActionForm action={resetPasswordPengguna} submit="Reset password" className="lg:w-64">
                  <input type="hidden" name="id" value={u.id} />
                  <p className="text-xs text-slate-500">Membuat password acak baru dan membuka kunci akun.</p>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Tambah akun">
        <ActionForm action={tambahPengguna} submit="Buat akun" className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="field-label">
              Username
              <input name="username" required pattern="[a-z0-9._\-]{3,32}" autoComplete="off" placeholder="mis. andi.hc" className="field" />
            </label>
            <label className="field-label">
              Nama lengkap
              <input name="nama" required autoComplete="off" className="field" />
            </label>
            <label className="field-label">
              Peran
              <select name="peran" defaultValue="editor" className="field">
                {PERAN.map((p) => (
                  <option key={p} value={p}>
                    {PERAN_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-500">Password awal dibuat acak dan ditampilkan sekali setelah akun dibuat. Pengguna sebaiknya menggantinya di menu Akun saya.</p>
        </ActionForm>
      </Card>
    </div>
  );
}

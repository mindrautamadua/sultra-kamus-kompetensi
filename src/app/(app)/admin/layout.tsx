import { PageHeader } from "@/components/ui";
import { TabAdmin } from "./tab-admin";

// Area khusus admin. Hak akses diperiksa di tiap halaman (bolehKelolaAkun) dan diulang di Server Actions-nya;
// layout ini hanya kerangka judul + tab agar bagian statisnya tetap bisa di-prerender.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <PageHeader title="Admin" desc="Kelola akun pengguna dan pengaturan aplikasi. Hanya admin yang dapat membuka halaman ini." />
      <TabAdmin />
      {children}
    </>
  );
}

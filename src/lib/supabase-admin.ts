import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Write client for Server Actions. Uses the service role key (bypasses RLS), so it must never reach the browser.
// Callers must check the session first (wajibLogin) and the role (src/lib/peran.ts).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function admin() {
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local (lihat `npx supabase status`).");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

export function ok<R extends { data: unknown; error: { message: string } | null }>(res: R): NonNullable<R["data"]> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<R["data"]>;
}

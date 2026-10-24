"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "@/lib/auth-actions";

const input =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 shadow-xs outline-none transition-colors hover:border-slate-400 focus:border-brand-600 focus:ring-3 focus:ring-brand-600/20 aria-invalid:border-rose-400";

export function FormLogin({ dari }: { dari: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  const [lihat, setLihat] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const salah = !!state?.error;

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="dari" value={dari} />

      <div className="space-y-2">
        <label htmlFor="username" className="block text-sm font-medium text-slate-700">
          Username
        </label>
        <input
          id="username"
          name="username"
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state?.username}
          aria-invalid={salah || undefined}
          className={input}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={lihat ? "text" : "password"}
            required
            autoComplete="current-password"
            aria-invalid={salah || undefined}
            aria-describedby={capsLock ? "caps-lock" : undefined}
            onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
            className={`${input} pr-24`}
          />
          <button
            type="button"
            onClick={() => setLihat((v) => !v)}
            aria-pressed={lihat}
            aria-controls="password"
            className="absolute inset-y-1 right-1 rounded-md px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            {lihat ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>
        {capsLock && (
          <p id="caps-lock" className="animate-[masuk_250ms_ease-out_both] text-sm text-amber-800">
            Caps Lock sedang aktif.
          </p>
        )}
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          name="ingat"
          defaultChecked={state?.ingat}
          className="size-4 cursor-pointer rounded border-slate-300 accent-brand-700"
        />
        Ingat saya selama 30 hari
      </label>

      {/* disembunyikan selama memproses, jadi muncul ulang (dan bergetar) di setiap percobaan yang gagal */}
      {state?.error && !pending && (
        <p
          role="alert"
          className="animate-[goyang_400ms_cubic-bezier(0.36,0.07,0.19,0.97)_both] rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 ring-1 ring-inset ring-rose-200"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn-primary h-11 w-full text-[15px] transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
      >
        {pending && (
          <svg viewBox="0 0 20 20" fill="none" className="size-4 animate-spin" aria-hidden>
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2.5} />
            <path d="M17.5 10A7.5 7.5 0 0 0 10 2.5" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
          </svg>
        )}
        {pending ? "Memeriksa" : "Masuk"}
      </button>
    </form>
  );
}

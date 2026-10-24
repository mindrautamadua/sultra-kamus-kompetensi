"use client";

import { useFormStatus } from "react-dom";

// Submit button for the GET filter forms (next/form). While the new results load it shows a spinner and
// sets data-pending, which globals.css uses to dim the stale results below the form.
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary min-w-28" data-pending={pending || undefined} aria-busy={pending}>
      {pending && (
        <svg viewBox="0 0 20 20" fill="none" className="size-4 animate-spin" aria-hidden>
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity={0.3} strokeWidth={2.5} />
          <path d="M17.5 10A7.5 7.5 0 0 0 10 2.5" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
        </svg>
      )}
      {pending ? "Memuat…" : children}
    </button>
  );
}

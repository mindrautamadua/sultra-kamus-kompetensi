"use client";

import { useEffect } from "react";

// Tombol menu di layar sempit (< md). Sama seperti SidebarToggle, statusnya disimpan sebagai atribut
// <html data-menu="open"> (varian `menu-open:`), bukan state React, jadi kerangka server tidak bergantung padanya.
function tutup() {
  delete document.documentElement.dataset.menu;
}

export function MenuHp() {
  useEffect(() => {
    // tautan di dalam menu (navigasi, Akun saya, Admin) menutup menu setelah diklik
    function onClick(e: MouseEvent) {
      if ((e.target as Element).closest("[data-menu-panel] a")) tutup();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") tutup();
    }
    // menu tidak boleh tertinggal terbuka saat layar dilebarkan ke tampilan sidebar
    const lebar = window.matchMedia("(min-width: 48rem)");
    lebar.addEventListener("change", tutup);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      lebar.removeEventListener("change", tutup);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function toggle() {
    const el = document.documentElement;
    if (el.dataset.menu === "open") tutup();
    else el.dataset.menu = "open";
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Buka / tutup menu"
      title="Menu"
      className="grid size-10 shrink-0 place-items-center rounded-lg text-brand-200 transition-colors hover:bg-white/10 hover:text-white md:hidden"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-6" aria-hidden>
        <path className="menu-open:hidden" d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" strokeLinecap="round" />
        <path className="hidden menu-open:block" d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Latar gelap di belakang menu HP yang terbuka; ketuk untuk menutup. */
export function TiraiMenuHp() {
  return <div onClick={tutup} className="fixed inset-0 hidden bg-slate-950/50 menu-open:block md:hidden" aria-hidden />;
}

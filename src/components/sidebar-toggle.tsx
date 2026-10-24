"use client";

import { SIDEBAR_KEY } from "@/lib/sidebar";

// Toggles the attribute directly instead of React state: the server-rendered shell never depends on it,
// so there is nothing to hydrate or mismatch.
export function SidebarToggle() {
  function toggle() {
    const el = document.documentElement;
    const collapsed = el.dataset.sidebar !== "collapsed";
    if (collapsed) el.dataset.sidebar = "collapsed";
    else delete el.dataset.sidebar;
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Ciutkan / lebarkan menu"
      title="Ciutkan / lebarkan menu"
      className="hidden shrink-0 rounded-lg p-1.5 text-brand-300 transition-colors hover:bg-white/10 hover:text-white md:block"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-5 transition-transform collapsed:rotate-180" aria-hidden>
        <path d="M3.5 4.5v11M12.5 5.5 8 10l4.5 4.5M8 10h8.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

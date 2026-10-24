"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { MENU as ITEMS } from "@/lib/menu";

// The pathname is runtime data, so the active state streams in behind Suspense
// while the plain link list is part of the prerendered shell.
export function Nav() {
  return (
    <Suspense fallback={<NavList path={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavList path={usePathname()} />;
}

function NavList({ path }: { path: string | null }) {
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((it) => {
        const active = path !== null && (it.href === "/" ? path === "/" : path.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            title={it.label}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-10 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors duration-150 md:collapsed:justify-center md:collapsed:px-0 ${
              active
                ? "bg-white/10 text-white before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r before:bg-amber-400 md:collapsed:before:-left-3"
                : "text-brand-200 hover:bg-white/5 hover:text-white"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={`size-5 shrink-0 ${active ? "text-amber-300" : ""}`} aria-hidden>
              <path d={it.icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="md:collapsed:sr-only">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

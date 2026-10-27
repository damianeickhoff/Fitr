"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const IN_APP = "fitr:inApp";
const SCROLL = "fitr:scroll";

/** Set by a browser back or forward, read by the page that mounts for it, cleared once it has. */
let cameBack = false;

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage switched off: back still works, it just starts at the top.
  }
}

/**
 * Rendered once in the app layout. It notes when the user has moved within
 * the app this session, so a back button can go back instead of starting the
 * wardrobe afresh, and when a page was reached by going back.
 */
export function HistoryMark() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    const onPop = () => {
      cameBack = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    // This sits after the page in the layout, so its effect runs after the
    // new page's own: they have had their chance to read `cameBack`.
    cameBack = false;
    if (first.current) {
      first.current = false;
      return;
    }
    write(IN_APP, true);
  }, [pathname]);

  return null;
}

/**
 * A back arrow: the previous page, scroll and filters as they were, when the
 * user came from somewhere in the app; the wardrobe when the page was opened
 * on its own (a fresh tab, the home-screen icon).
 */
export function BackLink({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href="/"
      aria-label={label}
      className={className}
      onClick={(event) => {
        if (!read<boolean>(IN_APP)) return;
        event.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}

/**
 * Remembers how far down a long page was when the user tapped something on
 * it, and returns there when they come back. The page is re-rendered on the
 * way back, so the browser's own restoring can land before the list is there.
 */
export function useScrollMemory() {
  useEffect(() => {
    const here = () => location.pathname + location.search;
    if (cameBack) {
      const saved = read<{ at: string; y: number }>(SCROLL);
      if (saved?.at === here()) requestAnimationFrame(() => window.scrollTo(0, saved.y));
    }
    const remember = () => write(SCROLL, { at: here(), y: window.scrollY });
    document.addEventListener("click", remember, true);
    return () => document.removeEventListener("click", remember, true);
  }, []);
}

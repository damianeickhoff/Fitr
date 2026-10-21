"use client";

import { Layers, Plus, Shirt, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MessageKey } from "@/lib/i18n";
import { usePendingUploads } from "@/lib/upload-queue";
import { useT } from "./locale";
import { cx } from "./ui";

const TABS: { href: string; label: MessageKey; icon: typeof Shirt; match: (p: string) => boolean; primary?: boolean }[] = [
  { href: "/", label: "nav.wardrobe", icon: Shirt, match: (p) => p === "/" || p.startsWith("/item") || p.startsWith("/never-worn") },
  { href: "/outfits", label: "nav.outfits", icon: Layers, match: (p) => p.startsWith("/outfits") },
  { href: "/add", label: "nav.add", icon: Plus, match: (p) => p === "/add", primary: true },
  { href: "/tips", label: "nav.tips", icon: ShoppingBag, match: (p) => p.startsWith("/tips") },
  { href: "/me", label: "nav.me", icon: User, match: (p) => p.startsWith("/me") },
];

/** Thumb-reach tabs in a floating pill at the bottom of the phone column, on every screen. */
export function Nav() {
  const pathname = usePathname();
  const pending = usePendingUploads();
  const t = useT();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-30 mx-auto max-w-[408px] rounded-full bg-ground/95 ring-1 ring-line ring-inset shadow-[0_14px_30px_-14px_rgba(35,31,26,0.35)] backdrop-blur-md"
    >
      <div className="grid h-[68px] grid-cols-5 items-center">
        {TABS.map(({ href, label, icon: Icon, match, primary }) => {
          const active = match(pathname);
          return primary ? (
            <Link key={href} href={href} aria-label={t(label)} aria-current={active ? "page" : undefined} className="flex justify-center">
              <span className="relative grid size-[52px] place-items-center rounded-full bg-accent text-white transition hover:brightness-110">
                <Icon size={24} strokeWidth={2.6} />
                {pending > 0 && (
                  <span
                    aria-label={t.count("nav.uploading", pending)}
                    className="absolute -top-1 -right-1 grid min-w-[22px] place-items-center rounded-full bg-ink px-1.5 py-0.5 text-[11px] font-bold text-paper ring-2 ring-ground"
                  >
                    {pending}
                  </span>
                )}
              </span>
            </Link>
          ) : (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx("flex flex-col items-center gap-[3px] text-[10px] font-bold", active ? "text-ink" : "text-muted")}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              {t(label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

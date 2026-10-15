"use client";

import { Camera, Layers, Shirt, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const TABS = [
  { href: "/", label: "Wardrobe", icon: Shirt, match: (p: string) => p === "/" || p.startsWith("/item") },
  { href: "/outfits", label: "Outfits", icon: Layers, match: (p: string) => p.startsWith("/outfits") },
  { href: "/add", label: "Add", icon: Camera, match: (p: string) => p === "/add", primary: true },
  { href: "/tips", label: "Shop tips", icon: ShoppingBag, match: (p: string) => p.startsWith("/tips") },
  { href: "/me", label: "Me", icon: User, match: (p: string) => p.startsWith("/me") },
];

/** Thumb-reach tabs, pinned to the bottom of the phone column on every screen size. */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[440px] border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <div className="grid h-[68px] grid-cols-5 items-center">
        {TABS.map(({ href, label, icon: Icon, match, primary }) => {
          const active = match(pathname);
          return primary ? (
            <Link key={href} href={href} aria-label="Add pieces" aria-current={active ? "page" : undefined} className="flex justify-center">
              <span className="-mt-7 grid size-[58px] place-items-center rounded-full bg-cobalt text-white shadow-[0_10px_22px_-8px_rgba(42,68,232,0.6)] ring-4 ring-paper">
                <Icon size={24} strokeWidth={2.2} />
              </span>
            </Link>
          ) : (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx("flex flex-col items-center gap-1 text-[10px]", active ? "font-semibold text-ink" : "font-medium text-muted")}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

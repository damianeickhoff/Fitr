import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { LocaleProvider } from "@/components/locale";
import { Nav } from "@/components/nav";
import { Wordmark } from "@/components/wordmark";
import { requireProfile } from "@/lib/auth";
import { translator } from "@/lib/i18n";
import { profileLocale } from "@/lib/locale";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile } = await requireProfile();
  const locale = profileLocale(profile);
  const t = translator(locale);

  return (
    <LocaleProvider locale={locale}>
      <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between bg-paper/95 px-5 backdrop-blur-md">
        <Link href="/" aria-label={t("header.wardrobe")}>
          <Wordmark />
        </Link>
        {/* The profile chip: who this wardrobe belongs to, and the way to the others. */}
        <Link
          href="/me"
          aria-label={t("header.profile")}
          className="flex items-center gap-1.5 rounded-full bg-ground py-1 pr-2.5 pl-1 text-[13px] font-bold ring-1 ring-line ring-inset"
        >
          <span className="grid size-7 place-items-center rounded-full bg-accent text-[12px] font-extrabold text-white">
            {profile.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="max-w-[110px] truncate">{profile.name}</span>
          <ChevronDown size={14} strokeWidth={2.4} className="text-muted" />
        </Link>
      </header>
      <main className="px-5 pt-2 pb-32">{children}</main>
      <Nav />
    </LocaleProvider>
  );
}

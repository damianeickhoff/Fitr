import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { PhoneStage } from "@/components/phone-stage";
import { getCurrentProfile } from "@/lib/auth";
import { DEFAULT_ACCENT, isHex } from "@/lib/colour";
import { currentLocale } from "@/lib/locale";
import "./globals.css";

const body = Nunito({ variable: "--font-body", subsets: ["latin"], weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "FITR", template: "%s · FITR" },
  description: "Your wardrobe as a shop, with outfits and styling advice.",
  appleWebApp: { capable: true, title: "FITR", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f7f2e9",
  viewportFit: "cover",
};

/**
 * The open profile's accent colour and language are set here, on <html>, so
 * every page and the sign-in screen read them from CSS and `lang` alone.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [profile, locale] = await Promise.all([getCurrentProfile(), currentLocale()]);
  const accent = profile && isHex(profile.accent) ? profile.accent : DEFAULT_ACCENT;
  return (
    <html lang={locale} className={`${body.variable} antialiased`} style={{ "--accent": accent } as React.CSSProperties}>
      <body>
        <PhoneStage locale={locale}>{children}</PhoneStage>
      </body>
    </html>
  );
}

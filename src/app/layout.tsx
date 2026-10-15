import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Syncopate } from "next/font/google";
import { PhoneStage } from "@/components/phone-stage";
import "./globals.css";

const display = Syncopate({ variable: "--font-display", subsets: ["latin"], weight: ["700"] });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "FITR", template: "%s · FITR" },
  description: "Your wardrobe as a shop, with outfits and styling advice.",
  appleWebApp: { capable: true, title: "FITR", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} antialiased`}>
      <body>
        <PhoneStage>{children}</PhoneStage>
      </body>
    </html>
  );
}

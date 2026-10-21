import { translator, type Locale } from "@/lib/i18n";
import { phoneUrl, qrSvg } from "@/lib/phone-url";
import { Wordmark } from "./wordmark";

/**
 * FITR is built for phones. On a wide screen the app keeps its phone layout in
 * a centred column, and the space beside it offers the phone link instead of a
 * desktop layout nobody would use.
 */
export async function PhoneStage({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = translator(locale);
  const { url, viaLan } = await phoneUrl();
  const svg = await qrSvg(url);

  return (
    <div className="min-h-dvh">
      <aside
        aria-label={t("stage.made")}
        className="fixed top-1/2 hidden w-64 -translate-y-1/2 xl:block"
        style={{ left: "max(32px, calc(50% - 220px - 336px))" }}
      >
        <Wordmark className="text-2xl" />
        <p className="mt-5 text-2xl leading-tight font-extrabold tracking-tight">{t("stage.made")}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("stage.scan")}</p>
        <div className="mt-6 w-40 rounded-[22px] bg-ground p-4 ring-1 ring-line ring-inset">
          {/* The SVG is generated locally by the qrcode package from our own URL. */}
          <div className="aspect-square" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <p className="mt-3 font-mono text-xs break-all text-muted">{url}</p>
        {viaLan && <p className="mt-2 text-xs leading-relaxed text-muted">{t("stage.wifi")}</p>}
      </aside>

      <div className="relative mx-auto min-h-dvh w-full max-w-[440px] bg-paper sm:shadow-[0_0_0_1px_rgba(35,31,26,0.06),0_30px_80px_-30px_rgba(35,31,26,0.3)]">
        {children}
      </div>
    </div>
  );
}

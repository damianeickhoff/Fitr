"use client";

import { Share, SquarePlus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "./locale";
import { button, cx, panel } from "./ui";

const DISMISS_KEY = "fitr.install.dismissedAt";
const DISMISS_FOR = 30 * 24 * 60 * 60 * 1000;

/** Chrome's install event; not in the DOM typings. */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function standalone() {
  return matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function dismissedRecently() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < DISMISS_FOR;
  } catch {
    return false;
  }
}

// iOS has no install event: Safari only offers it through the Share sheet.
// iPadOS passes itself off as a Mac, hence the touch check. Other iOS
// browsers word the menu differently, so they get no hint.
function iosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

const noSubscription = () => () => {};

/**
 * Offers to put FITR on the home screen, on the wardrobe page only and never
 * once it runs from there. Android hands us a real install prompt; iOS gets
 * the two taps written out. "Not now" holds for 30 days.
 */
export function InstallHint() {
  const t = useT();
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const eligible = useSyncExternalStore(noSubscription, () => !standalone() && !dismissedRecently(), () => false);
  const ios = useSyncExternalStore(noSubscription, iosSafari, () => false);

  useEffect(() => {
    const offer = (event: Event) => {
      // Keep Chrome's own mini-bar away; the banner below asks instead.
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (pathname !== "/" || !eligible || dismissed || (!prompt && !ios)) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private browsing: the banner simply returns next visit.
    }
    setDismissed(true);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event can be used once; Chrome sends a new one if it may ask again.
    setPrompt(null);
    if (outcome === "dismissed") dismiss();
  }

  const [beforeShare, afterShare] = t("install.ios.share").split("{share}");

  return (
    <aside className={cx(panel, "relative mx-5 mt-1 mb-2 p-4")}>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("install.dismiss")}
        className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full text-muted transition hover:text-ink"
      >
        <X size={17} strokeWidth={2.4} />
      </button>
      <div className="flex items-center gap-3 pr-7">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 44px icon from public/, nothing to optimise */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-[12px]" />
        <div>
          <p className="text-[15px] leading-snug font-extrabold">{t("install.title")}</p>
          <p className="text-[13px] font-semibold text-muted">{t("install.body")}</p>
        </div>
      </div>
      {prompt ? (
        <button type="button" onClick={install} className={cx(button.primary, "mt-3.5 w-full py-2.5")}>
          <SquarePlus size={18} strokeWidth={2.4} />
          {t("install.add")}
        </button>
      ) : (
        <ol className="mt-3.5 space-y-2 text-[13.5px] font-semibold">
          <li className="flex items-center gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-extrabold text-white">1</span>
            <span>
              {beforeShare}
              <Share size={16} strokeWidth={2.4} aria-hidden className="mx-0.5 inline -translate-y-0.5 text-[#007aff]" />
              {afterShare}
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-extrabold text-white">2</span>
            <span className="flex items-center gap-1.5">
              <SquarePlus size={16} strokeWidth={2.4} aria-hidden />
              {t("install.ios.add")}
            </span>
          </li>
        </ol>
      )}
    </aside>
  );
}

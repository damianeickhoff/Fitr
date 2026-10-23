"use client";

import { ImagePlus, Send } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { prepareSingle, sendToChatGpt, type HandoffKit } from "@/lib/chatgpt-handoff";
import { shrinkImage } from "@/lib/client-image";
import { addStudioFromApp } from "@/lib/item-actions";
import { imageUrl } from "@/lib/storage-url";
import { studioPrompt } from "@/lib/studio";
import { useT } from "./locale";
import { button, cx, panel, pill } from "./ui";

const DOWNLOAD = "fitr-studio.jpg";

/**
 * The free studio photo: the photo as taken goes to the user's ChatGPT app
 * with the same prompt the API gets, and the picture it draws comes back as
 * the listing. Shown whether or not an image key is set up.
 */
export function StudioPanel({ id, name, aiTagged, photoPath }: { id: string; name: string; aiTagged: boolean; photoPath: string }) {
  const t = useT();
  // Prepared ahead of the tap: a share sheet only opens straight from one.
  const [kit, setKit] = useState<HandoffKit | null>(null);
  const [sent, setSent] = useState<"shared" | "fallback" | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const prompt = studioPrompt(aiTagged ? name : null);
  const [fallbackBefore, fallbackAfter] = t("tryon.fallback").split("{file}");

  useEffect(() => {
    let current = true;
    prepareSingle(imageUrl(photoPath), name)
      .then((k) => current && setKit(k))
      .catch(() => current && setMessage({ text: t("tryon.loadFailed"), error: true }));
    return () => {
      current = false;
    };
  }, [photoPath, name, t]);

  function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    startUpload(async () => {
      const form = new FormData();
      form.set("photo", await shrinkImage(file, 2000), "studio.jpg");
      const result = await addStudioFromApp(id, form);
      setMessage(result.error ? { text: result.error, error: true } : { text: t("studio.added"), error: false });
      if (!result.error) setSent(null);
    });
  }

  return (
    <section className={cx(panel, "mt-5 p-4")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold">{t("studio.title")}</h2>
        <span className={pill("green")}>{t("tryon.free")}</span>
      </div>
      <p className="mt-1 text-[13px] font-bold text-muted">{t("tryon.withApp")}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed font-semibold text-muted">{t("studio.appBody")}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!kit}
          onClick={() => kit && setSent(sendToChatGpt(kit, prompt, DOWNLOAD))}
          className={cx(button.dark, "px-3 py-2.5 text-sm")}
        >
          <Send size={15} /> {kit ? t("tryon.send") : t("tryon.preparing")}
        </button>
        <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className={cx(button.secondary, "px-3 text-sm")}>
          <ImagePlus size={15} /> {uploading ? t("tryon.adding") : t("tryon.addPicture")}
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
      />

      {sent === "shared" && (
        <p className="mt-2.5 text-[13px] leading-relaxed font-semibold text-[#1d6b3a]" role="status">
          {t("tryon.shared")}
        </p>
      )}
      {sent === "fallback" && (
        <p className="mt-2.5 text-[13px] leading-relaxed font-semibold text-[#1d6b3a]" role="status">
          {fallbackBefore}
          <strong>{DOWNLOAD}</strong>
          {fallbackAfter}
        </p>
      )}
      {message && (
        <p className={cx("mt-2.5 text-sm font-semibold", message.error ? "text-danger" : "text-[#1d6b3a]")} role={message.error ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      <details className="mt-2.5 text-[13px]">
        <summary className="cursor-pointer font-bold text-muted">{t("tryon.seePrompt")}</summary>
        <p className="mt-1.5 rounded-xl bg-ground p-3 leading-relaxed whitespace-pre-line text-[#3f3931] ring-1 ring-line ring-inset">{prompt}</p>
      </details>
    </section>
  );
}

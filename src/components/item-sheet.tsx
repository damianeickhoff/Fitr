"use client";

import { Camera, ChevronLeft, ChevronRight, CalendarDays, Loader2, Pencil, Scissors, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import type { Item } from "@/generated/prisma/browser";
import { shrinkImage } from "@/lib/client-image";
import { SEASONS } from "@/lib/garment";
import type { MessageKey } from "@/lib/i18n";
import { deleteItem, dismissQuality, makeStudioPhoto, recutItem, replacePhoto, suggestDetails } from "@/lib/item-actions";
import type { QualityIssue } from "@/lib/photo-quality";
import { imageUrl } from "@/lib/storage-url";
import { detailValues, mergeSuggestion, type DetailKey, type DetailValues, type MergeMode } from "@/lib/suggest";
import { ItemEditor } from "./item-editor";
import { useT } from "./locale";
import { StudioPanel } from "./studio-panel";
import { TONES, button, cx, pill, type Tone } from "./ui";
import { WornDays, type Day } from "./worn-days";

export type SheetView = "menu" | "edit" | "studio" | "wear" | "original";

const SheetContext = createContext<(view: SheetView) => void>(() => {});

/** Opens the item's sheet at one of its views; the page's ⋯, banners and Edit link are these. */
export function SheetButton({ view, className, label, children }: { view: SheetView; className?: string; label?: string; children: React.ReactNode }) {
  const open = useContext(SheetContext);
  return (
    <button type="button" onClick={() => open(view)} aria-label={label} className={className}>
      {children}
    </button>
  );
}

function formValues(form: HTMLFormElement): DetailValues {
  const data = new FormData(form);
  const text = (key: string) => String(data.get(key) ?? "").trim();
  return {
    name: text("name"),
    category: text("category"),
    subcategory: text("subcategory"),
    colors: text("colors"),
    colorHex: text("colorHex"),
    brand: text("brand"),
    material: text("material"),
    pattern: text("pattern"),
    styles: text("styles"),
    formality: Number(text("formality")) || 0,
    seasons: SEASONS.filter((s) => data.getAll("seasons").includes(s)),
    description: text("description"),
  };
}

type Status = { text: string; error?: boolean } | null;

/**
 * Everything on the item page that isn't an everyday tap lives in one bottom
 * sheet: fixing the photo, editing the details, the wear history and removing
 * the piece. The page stays a listing; the sheet opens at the view a button asks
 * for. A re-check's draft is held here, so it survives closing the sheet.
 */
export function ItemSheet({
  item,
  issue,
  recheck,
  studio,
  wear,
  children,
}: {
  item: Item;
  /** What the photo checks flagged, when there is a note to show with it. */
  issue: QualityIssue | null;
  recheck: boolean;
  /** `apiLabel` names the image provider when one-tap studio photos are set up. */
  studio: { apiLabel: string | null; pending: boolean };
  wear: { days: Day[]; earlier: number; logged: number; today: string };
  children: React.ReactNode;
}) {
  const t = useT();
  const [view, setView] = useState<SheetView | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<{ values: DetailValues; changed: DetailKey[]; version: number } | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const open = (next: SheetView) => {
    setStatus(null);
    setView(next);
  };
  const close = () => setView(null);

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setView(null);
    window.addEventListener("keydown", onKey);
    // The page behind keeps still while the sheet scrolls.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [view]);

  const run = (mode: MergeMode) => {
    // Outside the transition, or it would only show once the answer is in.
    setStatus({ text: t("recheck.working") });
    setView("edit");
    start(async () => {
      const result = await suggestDetails(item.id);
      if (!result.ok) {
        setStatus({ text: result.error, error: true });
        return;
      }
      // Merged into what the form shows now, so unsaved hand edits count as filled in.
      const form = editor.current?.querySelector("form");
      const current = form ? formValues(form) : (draft?.values ?? detailValues(item));
      const { values, changed } = mergeSuggestion(current, result.suggestion, mode, { untagged: !item.aiTagged });
      if (changed.length === 0) {
        setStatus({ text: t("recheck.nothing") });
        return;
      }
      setDraft({ values, changed, version: (draft?.version ?? 0) + 1 });
      setStatus({ text: t("recheck.filled") });
    });
  };

  const act = (working: string, done: string, action: () => Promise<{ error?: string }>) => {
    setStatus({ text: working });
    start(async () => {
      const result = await action();
      setStatus(result.error ? { text: result.error, error: true } : { text: done });
    });
  };

  function retake(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setStatus({ text: t("quality.replacing") });
    start(async () => {
      const form = new FormData();
      form.set("photo", await shrinkImage(file), "photo.jpg");
      const result = await replacePhoto(item.id, form);
      setStatus(result.ok ? { text: t("quality.replaced") } : { text: result.error, error: true });
    });
  }

  const titles: Record<SheetView, string> = {
    menu: item.name,
    edit: t("item.edit"),
    studio: t("studio.title"),
    wear: t("menu.wear"),
    original: t("item.original"),
  };

  const statusLine = status && (
    <p className={cx("mt-3 text-sm font-semibold", status.error ? "text-danger" : "text-muted")} role={status.error ? "alert" : "status"}>
      {status.text}
    </p>
  );

  return (
    <SheetContext.Provider value={open}>
      {children}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          retake(e.target.files);
          e.target.value = "";
        }}
      />
      {view && (
        <div role="dialog" aria-modal="true" aria-label={titles[view]} className="fixed inset-0 z-50">
          <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-ink/45" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-[440px] overflow-y-auto rounded-t-[28px] bg-ground px-5 pt-2 pb-[max(28px,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-12px_rgba(35,31,26,0.35)]">
            <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-line" />
            <div className="flex items-center gap-3 border-b border-line pb-2.5">
              {view === "menu" ? (
                // eslint-disable-next-line @next/next/no-img-element -- private listing image
                <img src={imageUrl(item.imagePath)} alt="" className="h-[55px] w-11 shrink-0 rounded-[10px] bg-[#efe8db] object-cover" />
              ) : (
                <button type="button" onClick={() => open("menu")} aria-label={t("common.back")} className="grid size-10 shrink-0 place-items-center rounded-full bg-paper">
                  <ChevronLeft size={20} strokeWidth={2.4} />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-extrabold">{titles[view]}</p>
                {view === "menu" && <p className="text-[12.5px] font-semibold text-muted">{t("item.menuHint")}</p>}
              </div>
              <button type="button" autoFocus onClick={close} aria-label={t("common.close")} className="grid size-10 shrink-0 place-items-center rounded-full bg-paper">
                <X size={20} strokeWidth={2.4} />
              </button>
            </div>

            {view === "menu" && (
              <>
                {issue && (
                  <div className="mt-3 rounded-2xl bg-[#f6e6c6] p-3 text-sm font-semibold text-[#7d4b00]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cx(pill("amber"), "bg-[#fff4de]")}>{t(`quality.issue.${issue}` as MessageKey)}</span>
                      <span className="font-extrabold">{t("quality.title")}</span>
                    </div>
                    <p className="mt-1.5 leading-relaxed">{item.qualityNote}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <button type="button" disabled={pending} onClick={() => cameraInput.current?.click()} className={cx(button.secondary, "px-3 py-2 text-[13px]")}>
                        <Camera size={15} /> {t("quality.retakePhoto")}
                      </button>
                      <button type="button" disabled={pending} onClick={() => start(() => dismissQuality(item.id))} className={cx(button.quiet, "px-2.5 text-[13px]")}>
                        {t("quality.keep")}
                      </button>
                    </div>
                  </div>
                )}

                <h2 className="mt-4 mb-0.5 text-[13px] font-extrabold text-muted">{t("menu.photo")}</h2>
                {!issue && (
                  <Row icon={<Camera size={18} />} tone="amber" label={t("quality.retakePhoto")} hint={t("menu.retakeHint")} disabled={pending} onClick={() => cameraInput.current?.click()} />
                )}
                {studio.pending ? (
                  <Row icon={<Loader2 size={18} className="animate-spin" />} tone="violet" label={t("studio.title")} hint={t("studio.pending")} disabled />
                ) : (
                  <Row
                    icon={<Wand2 size={18} />}
                    tone="violet"
                    label={t("studio.title")}
                    hint={studio.apiLabel ? t("menu.studioHint") : t("menu.studioAppHint")}
                    onClick={() => open("studio")}
                    more
                  />
                )}
                <Row
                  icon={<Scissors size={18} />}
                  tone="grey"
                  label={t("actions.recut")}
                  hint={t("menu.recutHint")}
                  disabled={pending}
                  onClick={() => act(t("actions.recutWorking"), t("actions.recutReady"), () => recutItem(item.id))}
                />
                <Row
                  icon={
                    // eslint-disable-next-line @next/next/no-img-element -- private original photo
                    <img src={imageUrl(item.photoPath)} alt="" className="size-[38px] rounded-full object-cover" />
                  }
                  label={t("item.original")}
                  hint={t("item.originalAlt")}
                  onClick={() => open("original")}
                  more
                />

                <h2 className="mt-4 mb-0.5 text-[13px] font-extrabold text-muted">{t("item.details")}</h2>
                <Row icon={<Pencil size={18} />} tone="blue" label={t("item.edit")} hint={t("menu.editHint")} onClick={() => open("edit")} more />
                {recheck && (
                  <Row icon={<Sparkles size={18} />} tone="teal" label={t("recheck.button")} hint={t("menu.recheckHint")} disabled={pending} onClick={() => run("replace")} />
                )}
                <Row
                  icon={<CalendarDays size={18} />}
                  tone="green"
                  label={t("menu.wear")}
                  hint={wear.logged > 0 ? t.count("menu.wearHint", wear.logged) : t("menu.wearNone")}
                  onClick={() => open("wear")}
                  more
                />

                <div className="mt-2 border-t border-line pt-2">
                  <Row
                    icon={<Trash2 size={18} />}
                    tone="danger"
                    label={t("menu.remove")}
                    disabled={pending}
                    onClick={() => {
                      if (confirm(t("actions.removeConfirm"))) start(() => deleteItem(item.id));
                    }}
                  />
                </div>
                {statusLine}
              </>
            )}

            {view === "edit" && (
              <div className="pt-4" ref={editor}>
                {recheck && (
                  <div className="mb-4 flex flex-wrap items-center gap-1">
                    <button type="button" disabled={pending} onClick={() => run("replace")} className={button.secondary}>
                      <Sparkles size={16} /> {t("recheck.button")}
                    </button>
                    <button type="button" disabled={pending} onClick={() => run("empty")} className={button.quiet}>
                      {t("recheck.fillEmpty")}
                    </button>
                  </div>
                )}
                {status && <div className="-mt-1 mb-4">{statusLine}</div>}
                {/* A new suggestion remounts the form so its values land in the inputs. */}
                <ItemEditor
                  key={draft?.version ?? 0}
                  id={item.id}
                  values={draft?.values ?? detailValues(item)}
                  changed={draft?.changed ?? []}
                  onSaved={() => {
                    setDraft(null);
                    close();
                  }}
                />
              </div>
            )}

            {view === "studio" && (
              <div className="grid gap-3 pt-4">
                {studio.apiLabel && (
                  <div className="rounded-2xl bg-paper p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">{t("tryon.oneTap")}</p>
                      <span className={pill("violet")}>{t("tryon.paid", { label: studio.apiLabel })}</span>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => act(t("actions.studioWorking"), t("actions.studioReady"), () => makeStudioPhoto(item.id))}
                      className={cx(button.primary, "mt-3 w-full")}
                    >
                      <Wand2 size={16} /> {t("studio.make")}
                    </button>
                    {statusLine}
                  </div>
                )}
                <StudioPanel id={item.id} name={item.name} aiTagged={item.aiTagged} photoPath={item.photoPath} />
              </div>
            )}

            {view === "wear" && (
              <div className="pt-4">
                <WornDays id={item.id} days={wear.days} earlier={wear.earlier} today={wear.today} />
              </div>
            )}

            {view === "original" && (
              <div className="pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- private original photo */}
                <img src={imageUrl(item.photoPath)} alt={t("item.originalAlt")} className="max-h-[70dvh] w-full rounded-2xl bg-paper object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
    </SheetContext.Provider>
  );
}

/** One line of the menu: a round badge, the label with a hint under it, and a chevron when it opens another view. */
function Row({
  icon,
  tone,
  label,
  hint,
  onClick,
  disabled,
  more,
}: {
  icon: React.ReactNode;
  tone?: Tone | "danger";
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  more?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx("flex min-h-14 w-full items-center gap-3 py-2 text-left disabled:opacity-60", tone === "danger" && "text-danger")}
    >
      <span className={cx("grid size-[38px] shrink-0 place-items-center rounded-full", tone === "danger" ? "bg-[#f3dcd6] text-danger" : tone && TONES[tone])}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold">{label}</span>
        {hint && <span className="text-[12.5px] font-semibold text-muted">{hint}</span>}
      </span>
      {more && <ChevronRight size={16} className="shrink-0 text-muted" />}
    </button>
  );
}

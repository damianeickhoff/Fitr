import clsx from "clsx";

export const cx = clsx;

export const button = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-[15px] font-bold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60",
  dark: "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-bold text-paper transition hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-ground px-4 py-2.5 text-sm font-bold text-ink ring-1 ring-line ring-inset transition hover:ring-ink/30 disabled:opacity-60",
  quiet:
    "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-muted transition hover:text-ink disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-danger transition hover:bg-danger/10 disabled:opacity-60",
};

export const field =
  "w-full rounded-2xl bg-ground px-3.5 py-3 text-[15px] text-ink placeholder:text-muted/70 ring-1 ring-line ring-inset focus:ring-accent focus:outline-none";

export const label = "mb-1.5 block text-[13px] font-semibold text-muted";

/** A near-white card on the cream page, edged with a hairline rather than a shadow. */
export const panel = "rounded-[22px] bg-ground ring-1 ring-line ring-inset";

/** A listing card: the tile sits inside with a little cream showing round it. */
export const card = "rounded-[26px] bg-ground p-2 pb-3 ring-1 ring-line ring-inset";

/** Filter and option chips: a pill that fills with ink when chosen. */
export function chip(active: boolean) {
  return cx(
    "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold whitespace-nowrap transition",
    active ? "bg-ink text-paper" : "bg-ground text-muted ring-1 ring-line ring-inset hover:text-ink",
  );
}

/**
 * Colourful pills replace every tag and label in FITR. Each tone is a soft
 * tint with a dark text of the same hue, all at least 4.5:1 on the cream page.
 */
export const TONES = {
  blue: "bg-[#e3e8f7] text-[#24389c]",
  green: "bg-[#dcefe0] text-[#1d6b3a]",
  amber: "bg-[#f6e6c6] text-[#7d4b00]",
  pink: "bg-[#f3dcd6] text-[#7a2e2e]",
  violet: "bg-[#e9e2f3] text-[#4e3597]",
  teal: "bg-[#d8ecea] text-[#0f5f58]",
  grey: "bg-[#efe8db] text-[#5c554a]",
  solid: "bg-accent text-white",
  frost: "bg-[#fffdf9]/92 text-ink shadow-[0_1px_2px_rgba(35,31,26,0.14)] backdrop-blur-md",
} as const;

export type Tone = keyof typeof TONES;

export function pill(tone: Tone, size: "sm" | "md" = "sm") {
  return cx(
    "inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap",
    size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3 py-1.5 text-[12.5px]",
    TONES[tone],
  );
}

/** Stable colour for a free-text word (style words, seasons), so "minimal" is always violet. */
export function toneFor(word: string): Tone {
  const tones: Tone[] = ["violet", "teal", "pink", "amber", "green", "blue"];
  let hash = 0;
  for (const ch of word.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
}

/** Category pills keep one colour each across the app. */
export const CATEGORY_TONE: Record<string, Tone> = {
  top: "blue",
  bottom: "teal",
  dress: "pink",
  outerwear: "violet",
  shoes: "amber",
  bag: "green",
  accessory: "grey",
};

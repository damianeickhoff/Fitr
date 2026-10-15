import clsx from "clsx";

export const cx = clsx;

export const button = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-cobalt px-5 py-3 text-[15px] font-semibold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60",
  dark: "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line ring-inset transition hover:ring-ink/30 disabled:opacity-60",
  quiet:
    "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-muted transition hover:text-ink disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-60",
};

export const field =
  "w-full rounded-xl bg-ground px-3.5 py-3 text-[15px] text-ink placeholder:text-muted/70 ring-1 ring-transparent ring-inset focus:bg-paper focus:ring-cobalt focus:outline-none";

export const label = "mb-1.5 block text-[13px] font-medium text-muted";

/**
 * Colourful pills replace every tag and label in FITR. Each tone is a soft tint
 * with a dark text of the same hue, all at least 4.5:1 contrast.
 */
export const TONES = {
  blue: "bg-[#e4e9ff] text-[#2238c9]",
  green: "bg-[#dcf3e4] text-[#17693b]",
  amber: "bg-[#fdeccb] text-[#8a5300]",
  pink: "bg-[#fde2ea] text-[#a8244f]",
  violet: "bg-[#ebe5ff] text-[#5533c0]",
  teal: "bg-[#d9f2f0] text-[#0e6b63]",
  grey: "bg-ground text-[#3d4252]",
  solid: "bg-cobalt text-white",
  frost: "bg-white/85 text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)] backdrop-blur-md",
} as const;

export type Tone = keyof typeof TONES;

export function pill(tone: Tone, size: "sm" | "md" = "sm") {
  return cx(
    "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
    size === "sm" ? "px-2.5 py-[3px] text-[11.5px]" : "px-3 py-1 text-[12.5px]",
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

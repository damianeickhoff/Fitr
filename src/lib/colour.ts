/**
 * The accent colour a profile picks has to carry white text on buttons, so
 * the picker and the server both check it the same way. Shared with the client.
 */

export const DEFAULT_ACCENT = "#7a2e2e";

/** Presets on the Appearance screen: hue and lightness at the picker's fixed saturation. */
export const ACCENT_PRESETS = [
  { key: "oxblood", hue: 0, light: 33 },
  { key: "cobalt", hue: 232, light: 54 },
  { key: "raspberry", hue: 340, light: 42 },
  { key: "forest", hue: 150, light: 30 },
  { key: "clay", hue: 18, light: 44 },
  { key: "ochre", hue: 40, light: 36 },
  { key: "plum", hue: 282, light: 38 },
  { key: "ink", hue: 232, light: 14 },
] as const;

export const ACCENT_SATURATION = 62;

/** White text needs this much contrast on a button: WCAG AA for normal text. */
export const MIN_CONTRAST = 4.5;

export function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function hslToHex(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function luminance(hex: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio of white text on this colour. */
export function contrastWithWhite(hex: string) {
  return 1.05 / (luminance(hex) + 0.05);
}

export function accentIsReadable(hex: string) {
  return isHex(hex) && contrastWithWhite(hex) >= MIN_CONTRAST;
}

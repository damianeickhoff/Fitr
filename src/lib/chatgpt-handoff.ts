/**
 * Handing a try-on or a studio photo to the ChatGPT app, so it runs on the
 * user's own ChatGPT subscription instead of the paid API. Browser-only.
 *
 * Phones get the share sheet with the photos and the prompt. Where the share
 * sheet can't carry files (desktop browsers, and any page served over plain
 * http, which has no share or clipboard API), the prompt is copied, the photos
 * are downloaded as one collage and ChatGPT opens in a new tab.
 */

export type HandoffKit = { files: File[]; collage: Blob };

async function fetchBitmap(url: string) {
  const blob = await (await fetch(url)).blob();
  return { blob, bitmap: await createImageBitmap(blob) };
}

function drawCover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Me on the left, the numbered pieces in a grid on the right. */
async function makeCollage(person: ImageBitmap, pieces: ImageBitmap[]) {
  const W = 1600;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  drawCover(ctx, person, 0, 0, 720, H);

  const cols = pieces.length > 4 ? 3 : 2;
  const rows = Math.max(1, Math.ceil(pieces.length / cols));
  const cellW = (W - 720 - 20) / cols;
  const cellH = H / rows;
  pieces.forEach((piece, n) => {
    const x = 740 + (n % cols) * cellW;
    const y = Math.floor(n / cols) * cellH;
    drawCover(ctx, piece, x + 6, y + 6, cellW - 12, cellH - 12);
    ctx.fillStyle = "#1b1d2a";
    ctx.beginPath();
    ctx.arc(x + 34, y + 34, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n + 1), x + 34, y + 35);
  });
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw the collage."))), "image/jpeg", 0.9),
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Everything the hand-off needs, fetched ahead of the tap. */
export async function prepareKit(personUrl: string, pieces: { name: string; url: string }[]): Promise<HandoffKit> {
  const me = await fetchBitmap(personUrl);
  const clothes = await Promise.all(pieces.map((p) => fetchBitmap(p.url)));
  const files = [
    new File([me.blob], "me.jpg", { type: "image/jpeg" }),
    ...clothes.map((c, n) => new File([c.blob], `${n + 1}-${slug(pieces[n].name)}.jpg`, { type: "image/jpeg" })),
  ];
  const collage = await makeCollage(me.bitmap, clothes.map((c) => c.bitmap));
  return { files, collage };
}

/** A studio photo needs only the photo as taken: it is its own "collage". */
export async function prepareSingle(url: string, name: string): Promise<HandoffKit> {
  const blob = await (await fetch(url)).blob();
  return { files: [new File([blob], `${slug(name) || "photo"}.jpg`, { type: "image/jpeg" })], collage: blob };
}

/** Clipboard that also works on plain http, where navigator.clipboard is missing. */
function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return;
  }
  fallbackCopy(text);
}

function fallbackCopy(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

/**
 * Must run straight from the tap: share sheets and new tabs are only allowed
 * as a direct response to the user. Returns which route it took.
 */
export function sendToChatGpt(kit: HandoffKit, prompt: string, downloadName = "fitr-try-on.jpg"): "shared" | "fallback" {
  copyText(prompt);
  if (navigator.canShare?.({ files: kit.files })) {
    navigator.share({ files: kit.files, text: prompt }).catch(() => undefined);
    return "shared";
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(kit.collage);
  link.download = downloadName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  openChatGpt();
  return "fallback";
}

/**
 * Opens the ChatGPT app where one can be reached, the website otherwise. The
 * share sheet above is the better route, since it carries the photos, but a
 * page served over plain http has no share sheet, and the app is still the
 * place people want to land. Android takes an intent URL that falls back to
 * the site by itself; iOS takes the app's URL scheme, with the site opened
 * only if the page is still in front a moment later (an app that opened
 * would have sent it to the background).
 */
function openChatGpt() {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) {
    window.location.href = "intent://chat#Intent;scheme=chatgpt;package=com.openai.chatgpt;S.browser_fallback_url=https%3A%2F%2Fchatgpt.com%2F;end";
    return;
  }
  if (/iphone|ipad|ipod/i.test(ua)) {
    const started = Date.now();
    window.location.href = "chatgpt://";
    setTimeout(() => {
      if (document.visibilityState === "visible" && Date.now() - started < 2500) window.open("https://chatgpt.com/", "_blank", "noopener");
    }, 1500);
    return;
  }
  window.open("https://chatgpt.com/", "_blank", "noopener");
}

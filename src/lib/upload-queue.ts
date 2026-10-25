"use client";

import { useSyncExternalStore } from "react";
import { shrinkImage } from "@/lib/client-image";
import { addPhoto, replacePhoto, type AddPhotoResult } from "@/lib/item-actions";

export type Upload = {
  key: string;
  file: File;
  preview: string;
  status: "waiting" | "working" | "done" | "failed";
  result?: AddPhotoResult;
  /** A retake: this photo replaces that piece's pictures instead of adding one. */
  replaces?: string;
  /**
   * Only a request that never got an answer is worth sending again. The
   * server's own refusals (no clothing, too large) would just repeat, and its
   * AI failures already save the piece untagged rather than failing.
   */
  retryable?: boolean;
};

/**
 * The queue lives outside React so leaving the Add page doesn't cancel it:
 * photos keep going up while the user checks a new listing, and the list is
 * still there when they come back. Photos go up one at a time because
 * Gemini's free tier counts requests per minute, and a queue that finishes
 * slowly beats one that fails all at once. A full page reload still drops
 * whatever hasn't been sent, as any in-flight request would be.
 */
let uploads: Upload[] = [];
let chain: Promise<void> = Promise.resolve();
/** What a dropped request says, in the profile's language; set by whoever enqueues. */
let failedMessage = "The upload didn't go through. Check your connection and try again.";
const listeners = new Set<() => void>();

function publish(next: Upload[]) {
  uploads = next;
  for (const fn of listeners) fn();
}

function update(key: string, patch: Partial<Upload>) {
  publish(uploads.map((u) => (u.key === key ? { ...u, ...patch } : u)));
}

function send(key: string, file: File, replaces?: string) {
  chain = chain.then(async () => {
    update(key, { status: "working" });
    try {
      const form = new FormData();
      form.set("photo", await shrinkImage(file), "photo.jpg");
      const result = replaces ? await replacePhoto(replaces, form) : await addPhoto(form);
      update(key, { status: result.ok ? "done" : "failed", result });
      // The old card for the piece would show the picture that was just replaced.
      if (replaces && result.ok) dropItem(replaces, key);
    } catch {
      update(key, {
        status: "failed",
        retryable: true,
        result: { ok: false, error: failedMessage },
      });
    }
  });
}

export function enqueueUploads(files: FileList | File[] | null, failed?: string) {
  if (failed) failedMessage = failed;
  if (!files) return;
  for (const file of Array.from(files)) {
    const key = `${file.name}-${file.size}-${Math.random()}`;
    publish([{ key, file, preview: URL.createObjectURL(file), status: "waiting" }, ...uploads]);
    send(key, file);
  }
}

/** A retake for one flagged piece: queued like an upload, but it replaces the piece's pictures. */
export function enqueueReplacement(itemId: string, file: File | undefined, failed?: string) {
  if (failed) failedMessage = failed;
  if (!file) return;
  const key = `${itemId}-${file.size}-${Math.random()}`;
  publish([{ key, file, preview: URL.createObjectURL(file), status: "waiting", replaces: itemId }, ...uploads]);
  send(key, file, itemId);
}

/** Takes a piece out of every earlier result, except the upload named; an upload left empty goes too. */
function dropItem(itemId: string, except: string) {
  publish(
    uploads
      .map((u) => (u.key !== except && u.result?.ok ? { ...u, result: { ...u.result, items: u.result.items.filter((i) => i.id !== itemId) } } : u))
      .filter((u) => !(u.key !== except && u.result?.ok && u.result.items.length === 0)),
  );
}

/** The owner kept a flagged piece: its card stops suggesting a retake. */
export function clearQuality(itemId: string) {
  publish(
    uploads.map((u) =>
      u.result?.ok ? { ...u, result: { ...u.result, items: u.result.items.map((i) => (i.id === itemId ? { ...i, quality: null } : i)) } } : u,
    ),
  );
}

/** Sends a failed photo again from the file still held in memory, so it needn't be re-taken. */
export function retryUpload(key: string) {
  const upload = uploads.find((u) => u.key === key);
  if (!upload?.retryable || upload.status !== "failed") return;
  update(key, { status: "waiting", result: undefined, retryable: false });
  send(key, upload.file, upload.replaces);
}

/** Every new listing still waiting for its studio photo. */
export function pendingStudioIds(list: Upload[]): string[] {
  return list.flatMap((u) => (u.result?.ok ? u.result.items.filter((i) => i.studioPending).map((i) => i.id) : []));
}

/** Swaps in studio photos that have landed, so the listings on the Add page catch up. */
export function applyStudioStatus(statuses: { id: string; imagePath: string; pending: boolean }[]) {
  const byId = new Map(statuses.map((s) => [s.id, s]));
  publish(
    uploads.map((u) => {
      if (!u.result?.ok || !u.result.items.some((i) => byId.has(i.id))) return u;
      const items = u.result.items.map((i) => {
        const s = byId.get(i.id);
        return s ? { ...i, imagePath: s.imagePath, studioPending: s.pending } : i;
      });
      return { ...u, result: { ...u.result, items } };
    }),
  );
}

/** Drops finished and failed entries so the list only shows what's still relevant. */
export function clearSettledUploads() {
  for (const u of uploads) if (u.status === "done" || u.status === "failed") URL.revokeObjectURL(u.preview);
  publish(uploads.filter((u) => u.status === "waiting" || u.status === "working"));
}

const EMPTY: Upload[] = [];

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useUploads(): Upload[] {
  return useSyncExternalStore(subscribe, () => uploads, () => EMPTY);
}

/** How many photos are still waiting or being processed. */
export function usePendingUploads(): number {
  return useUploads().filter((u) => u.status === "waiting" || u.status === "working").length;
}

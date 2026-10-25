"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js in production builds only: in development a worker
 * would serve stale code and hide hot reloads.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // No worker means no offline page; the app itself is unaffected.
    });
  }, []);
  return null;
}

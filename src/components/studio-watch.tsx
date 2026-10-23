"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Rendered while a studio photo is on its way: re-reads the page every few
 * seconds so the new listing replaces the cut-out without a manual reload.
 * The page stops rendering it once nothing is pending, which stops the polling.
 */
export function StudioWatch({ every = 6000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), every);
    return () => clearInterval(timer);
  }, [router, every]);
  return null;
}

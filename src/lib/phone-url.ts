import "server-only";
import os from "node:os";
import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * The address a phone should open to reach this instance. On localhost that
 * address is useless to a phone, so the PC's LAN address is used instead —
 * which is what makes "scan to test on your phone" work during development.
 */
export async function phoneUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? "http";
  const [name, port] = host.split(/:(?=\d+$)/);

  if (name === "localhost" || name === "127.0.0.1" || name === "[::1]") {
    const lan = Object.values(os.networkInterfaces())
      .flat()
      .find((i) => i && i.family === "IPv4" && !i.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address));
    if (lan) return { url: `${proto}://${lan.address}${port ? `:${port}` : ""}`, viaLan: true };
  }
  return { url: `${proto}://${host}`, viaLan: false };
}

export async function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#1b1d2a", light: "#ffffff00" } });
}

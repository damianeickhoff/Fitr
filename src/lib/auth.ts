import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { authSecretBytes } from "./secrets";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session";

/**
 * Browsers drop `Secure` cookies over plain HTTP, which is how a self-hosted
 * instance on a LAN address is reached. Following the request's protocol keeps
 * that working while hardening real HTTPS.
 */
async function isHttps() {
  const h = await headers();
  return (
    h.get("x-forwarded-proto")?.split(",")[0].trim() === "https" ||
    h.get("origin")?.startsWith("https://") === true
  );
}

export async function createSession(userId: string, tokenVersion: number) {
  const token = await signSession({ userId, tokenVersion }, authSecretBytes());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, checked against the row so a revoked token is refused. */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value, authSecretBytes());
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, tokenVersion: true, styleNotes: true },
  });
  if (!user || user.tokenVersion !== session.tokenVersion) return null;
  return user;
});

/** For pages and actions: the user, or a trip to the sign-in page. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

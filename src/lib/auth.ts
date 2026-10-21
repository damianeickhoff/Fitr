import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { authSecretBytes } from "./secrets";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session";

/** Which of the account's profiles this device is using. Plain id: the session cookie is what proves sign-in. */
export const PROFILE_COOKIE = "fitr_profile";

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
  jar.delete(PROFILE_COOKIE);
}

/** Remembers the chosen profile on this device for a year. */
export async function rememberProfile(profileId: string) {
  const jar = await cookies();
  jar.set(PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** The signed-in user, checked against the row so a revoked token is refused. */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value, authSecretBytes());
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, tokenVersion: true },
  });
  if (!user || user.tokenVersion !== session.tokenVersion) return null;
  return user;
});

/**
 * The profile this device last chose, or the account's first one. An account
 * always has a profile: sign-up makes one and the migration gave existing
 * accounts one, but a deleted-last-profile edge case is healed here.
 */
export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const jar = await cookies();
  const wanted = jar.get(PROFILE_COOKIE)?.value;
  const profiles = await db.profile.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return profiles.find((p) => p.id === wanted) ?? profiles[0] ?? db.profile.create({ data: { userId: user.id, name: user.name } });
});

/** For pages and actions: the user, or a trip to the sign-in page. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For everything that touches a wardrobe: who is signed in and whose wardrobe is open. */
export async function requireProfile() {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return { user, profile };
}

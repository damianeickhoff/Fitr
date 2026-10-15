import { SignJWT, jwtVerify } from "jose";

/**
 * An HS256 JWT with the user id in `sub` and the account's `tokenVersion` in
 * `v`. Pure functions over a key, so the proxy can verify without a database.
 */
export const SESSION_COOKIE = "fitr_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type Session = { userId: string; tokenVersion: number };

export async function signSession(session: Session, key: Uint8Array): Promise<string> {
  return new SignJWT({ sub: session.userId, v: session.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifySession(
  token: string | undefined | null,
  key: Uint8Array,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return { userId: payload.sub, tokenVersion: typeof payload.v === "number" ? payload.v : 0 };
  } catch {
    return null;
  }
}

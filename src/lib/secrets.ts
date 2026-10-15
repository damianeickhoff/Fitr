/**
 * The key that signs session cookies. Shared by the proxy and server code, so
 * it reads the environment only — no `server-only`, no database.
 */
let cached: Uint8Array | null = null;

export function authSecretBytes(): Uint8Array {
  if (cached) return cached;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set (at least 16 characters).");
    }
    // Development only: a fixed key keeps sessions alive across restarts.
    cached = new TextEncoder().encode("fitr-development-secret-not-for-production");
    return cached;
  }
  cached = new TextEncoder().encode(secret);
  return cached;
}

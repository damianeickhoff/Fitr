import { NextResponse, type NextRequest } from "next/server";
import { authSecretBytes } from "@/lib/secrets";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * The sign-in gate. Signature only, no database: a revoked-but-signed token is
 * caught by `getCurrentUser` where data is actually read.
 */
export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, authSecretBytes());
  if (session) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|manifest\.webmanifest|icon|apple-icon|favicon\.ico).*)"],
};

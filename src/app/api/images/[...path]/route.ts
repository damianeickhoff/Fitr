import { getCurrentUser } from "@/lib/auth";
import { readStored } from "@/lib/storage";

// Cut-outs need transparency: WebP now, PNG on installs that haven't run
// `scripts/webp-cutouts.mjs`. Everything else is JPEG.
function contentType(relative: string) {
  if (relative.endsWith(".webp")) return "image/webp";
  if (relative.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

/**
 * Serves stored photos to their owner only: every path starts with the user's
 * id, so a session for anyone else gets a 404. Files are never rewritten in
 * place (a change makes a new file), so they can be cached for good.
 */
export async function GET(_: Request, { params }: RouteContext<"/api/images/[...path]">) {
  const user = await getCurrentUser();
  const { path } = await params;
  if (!user || path[0] !== user.id) return new Response("Not found", { status: 404 });

  try {
    const relative = path.join("/");
    const data = await readStored(relative);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType(relative),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

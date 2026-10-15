import { getCurrentUser } from "@/lib/auth";
import { readStored } from "@/lib/storage";

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
        // Cut-outs are PNG for their transparency; everything else is JPEG.
        "Content-Type": relative.endsWith(".png") ? "image/png" : "image/jpeg",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

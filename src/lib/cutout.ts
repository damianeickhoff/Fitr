import "server-only";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Background removal runs locally (an ONNX model shipped inside
 * @imgly/background-removal-node), so cut-outs cost nothing and photos never
 * leave the server. The package is AGPL-3.0: fine for a self-hosted instance,
 * worth knowing before anyone distributes FITR.
 *
 * Loaded lazily: the model is large and only the add-photo path needs it.
 */
type Remover = typeof import("@imgly/background-removal-node").removeBackground;
let remover: Promise<Remover> | null = null;

function load() {
  remover ??= import("@imgly/background-removal-node").then((m) => m.removeBackground);
  return remover;
}

// The package fetches its model files relative to `publicPath`, which defaults
// to the working directory; point it at its own dist folder instead.
function publicPath() {
  return pathToFileURL(
    path.join(/* turbopackIgnore: true */ process.cwd(), "node_modules/@imgly/background-removal-node/dist/"),
  ).href;
}

/** The subject of a photo on a transparent background, as PNG. */
export async function removeBackground(jpeg: Buffer): Promise<Buffer> {
  const remove = await load();
  const blob = await remove(new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), {
    publicPath: publicPath(),
    model: "medium",
    output: { format: "image/png" },
  });
  return Buffer.from(await blob.arrayBuffer());
}

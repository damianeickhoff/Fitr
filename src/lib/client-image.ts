/**
 * Phone photos are 3–8 MB; the AI and the shop grid need a fraction of that.
 * Shrinking in the browser makes uploads fast on mobile data. Anything the
 * browser can't decode is sent as-is and the server decides.
 */
export async function shrinkImage(file: File, max = 1800): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
}

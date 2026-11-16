/**
 * Shrinks an image in the browser before upload so stored covers stay small
 * (~30–80 KB). The longest side is capped at `maxSide`; output is WebP, or
 * JPEG where the browser can't encode WebP.
 */
export async function resizeImage(file: Blob, maxSide = 600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process that image");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    const webp = await encode("image/webp");
    const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg");
    if (!blob) throw new Error("Couldn't process that image");
    return blob;
  } finally {
    bitmap.close();
  }
}

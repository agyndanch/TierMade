/** Limits and type checks for uploaded cover images. Client-safe. */

export const MAX_IMAGE_BYTES = 1_000_000;
export const MAX_IMAGES_PER_USER = 500;

export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

/**
 * Identifies an image by its magic bytes, never by the client's claimed type.
 * Anything else (SVG, HTML, …) returns null so it can't be served as a page.
 */
export function sniffImageType(buf: Uint8Array): ImageType | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((b, j) => buf[i + j] === b);
  if (buf.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (buf.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (buf.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (buf.length >= 6 && (at(0, 0x47, 0x49, 0x46, 0x38, 0x37, 0x61) || at(0, 0x47, 0x49, 0x46, 0x38, 0x39, 0x61))) {
    return "image/gif";
  }
  return null;
}

/**
 * Catalog cover hosts the cover proxy may fetch from (Deezer, TMDB, IGDB).
 * https only, default port, exact host or a subdomain of dzcdn.net.
 */
export function isAllowedCoverUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.port || u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  return h === "image.tmdb.org" || h === "images.igdb.com" || h === "dzcdn.net" || h.endsWith(".dzcdn.net");
}

/** Path the app serves an uploaded image from. */
export const imagePath = (id: string) => `/api/images/${id}`;

/** The uploaded-image id inside an item's image_url, if it points at one. */
export function imageIdFromUrl(url: string | null | undefined): string | null {
  const m = url?.match(/^\/api\/images\/([0-9a-f-]{36})$/i);
  return m ? m[1] : null;
}

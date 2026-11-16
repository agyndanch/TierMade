import { findImage } from "@/repositories/images";

type Ctx = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Serves an uploaded cover. Public by design: ids are unguessable UUIDs (like
 * CDN links) and images never change, so they cache forever.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const image = UUID.test(id) ? await findImage(id) : null;
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

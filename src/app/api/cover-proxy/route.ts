import { HttpError } from "@/lib/errors";
import { handle, requireApiUser } from "@/lib/http";
import { isAllowedCoverUrl } from "@/lib/images";

const MAX_BYTES = 5_000_000;

/**
 * Same-origin copy of a catalog cover, so "Save as image" can draw it on a
 * canvas without the browser blocking it as cross-origin. Only the catalog
 * CDNs are allowed (never arbitrary URLs), and only for signed-in users.
 */
export const GET = handle(async (req: Request) => {
  await requireApiUser();
  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!isAllowedCoverUrl(url)) throw new HttpError(400, "That image host isn't supported");

  let upstream: Response;
  try {
    upstream = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "follow" });
  } catch {
    throw new HttpError(502, "Couldn't fetch that cover");
  }
  // A redirect must not lead us somewhere else.
  if (!isAllowedCoverUrl(upstream.url)) throw new HttpError(502, "Couldn't fetch that cover");
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/") || type.includes("svg")) {
    throw new HttpError(502, "Couldn't fetch that cover");
  }
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) throw new HttpError(502, "That cover is too large");

  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
});

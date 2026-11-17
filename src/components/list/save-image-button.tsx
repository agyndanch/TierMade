"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { EntryWithItem } from "@/repositories/entries";
import type { ListDisplay } from "@/lib/list-display";
import { renderChart } from "@/lib/chart-image";
import { isAllowedCoverUrl } from "@/lib/images";

/** Same-origin URL for a cover so the canvas can draw it, or null if it can't be drawn. */
function drawableUrl(url: string): string | null {
  if (url.startsWith("/api/images/")) return url;
  if (isAllowedCoverUrl(url)) return `/api/cover-proxy?url=${encodeURIComponent(url)}`;
  return null; // a pasted link to some other site: the tile shows the title instead
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const src = drawableUrl(url);
  if (!src) return null;
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

const fileName = (title: string) =>
  `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "tiermade-list"}.png`;

/** Downloads the grid as a PNG chart, following the list's display settings. */
export function SaveImageButton({
  title,
  slots,
  display,
  aspect,
}: {
  title: string;
  slots: (EntryWithItem | null)[];
  display: ListDisplay;
  aspect: "square" | "portrait";
}) {
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const blob = await renderChart({ title, slots, display, aspect, loadImage });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName(title);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {busy ? "Preparing…" : "Save as image"}
    </button>
  );
}

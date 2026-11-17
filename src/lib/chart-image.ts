/**
 * "Save as image": lays out a ranked list's grid (covers + the text beside each
 * row, following the list's display settings) and draws it on a canvas.
 * computeChartLayout is pure and unit-tested; renderChart needs a browser.
 */
import { labelFor, labelsShown, type ListDisplay } from "./list-display";

type Aspect = "square" | "portrait";
type ChartItem = { id: string; item: { title: string; subtitle: string | null; imageUrl: string | null } };
type Display = Pick<ListDisplay, "gridColumns" | "gridRows" | "showNumbers" | "showTitles" | "showCreators">;

export const CHART = {
  tile: 200,
  gap: 8,
  pad: 40,
  header: 64,
  footer: 36,
  textGap: 32,
  textWidth: 440,
  line: 26,
} as const;

export type ChartLayout = {
  width: number;
  height: number;
  tileW: number;
  tileH: number;
  /** x of the text column, or null when labels are off */
  textX: number | null;
  rowTops: number[];
  rowHeights: number[];
};

/** Sizes and positions for a chart of `display.gridRows` rows, given which slots are filled. */
export function computeChartLayout(display: Display, slots: (unknown | null)[], aspect: Aspect): ChartLayout {
  const cols = display.gridColumns;
  const rows = display.gridRows;
  const tileW = CHART.tile;
  const tileH = aspect === "portrait" ? Math.round(CHART.tile * 1.5) : CHART.tile;
  const withText = labelsShown(display);
  const gridW = cols * tileW + (cols - 1) * CHART.gap;

  const rowHeights = Array.from({ length: rows }, (_, r) => {
    if (!withText) return tileH;
    const lines = slots.slice(r * cols, r * cols + cols).filter((s) => s != null).length;
    return Math.max(tileH, lines * CHART.line);
  });
  const rowTops: number[] = [];
  let y = CHART.pad + CHART.header;
  for (const h of rowHeights) {
    rowTops.push(y);
    y += h + CHART.gap;
  }
  const height = y - CHART.gap + CHART.footer + CHART.pad;
  const width = CHART.pad * 2 + gridW + (withText ? CHART.textGap + CHART.textWidth : 0);
  return {
    width,
    height,
    tileW,
    tileH,
    textX: withText ? CHART.pad + gridW + CHART.textGap : null,
    rowTops,
    rowHeights,
  };
}

const COLORS = { bg: "#111214", tile: "#24252b", empty: "#3a3b42", text: "#f4f4f6", muted: "#8b8d98" };
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draws an image like CSS object-fit: cover. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

/** Wraps a title onto at most `maxLines` lines inside a tile without a cover. */
function drawPlaceholderTitle(ctx: CanvasRenderingContext2D, title: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 16px ${FONT}`;
  ctx.textAlign = "center";
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > w - 24 && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 4).map((l, i, arr) => (i === arr.length - 1 && lines.length > 4 ? fit(ctx, `${l}…`, w - 24) : fit(ctx, l, w - 24)));
  const top = y + h / 2 - (shown.length * 20) / 2 + 14;
  shown.forEach((l, i) => ctx.fillText(l, x + w / 2, top + i * 20));
  ctx.textAlign = "left";
}

/**
 * Renders the chart to a PNG. `loadImage` returns a ready image for a cover
 * URL, or null when it can't be drawn (the tile then shows the title).
 */
export async function renderChart({
  title,
  slots,
  display,
  aspect,
  loadImage,
}: {
  title: string;
  slots: (ChartItem | null)[];
  display: Display;
  aspect: Aspect;
  loadImage: (url: string) => Promise<HTMLImageElement | null>;
}): Promise<Blob> {
  const layout = computeChartLayout(display, slots, aspect);
  const cols = display.gridColumns;
  const shown = slots.slice(0, cols * display.gridRows);
  const images = await Promise.all(shown.map((e) => (e?.item.imageUrl ? loadImage(e.item.imageUrl) : Promise.resolve(null))));

  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't draw the image");

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = COLORS.text;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(fit(ctx, title, layout.width - CHART.pad * 2), CHART.pad, CHART.pad + 32);

  for (let r = 0; r < display.gridRows; r++) {
    const y = layout.rowTops[r];
    for (let c = 0; c < cols; c++) {
      const slot = r * cols + c;
      const x = CHART.pad + c * (layout.tileW + CHART.gap);
      const entry = shown[slot] ?? null;
      ctx.save();
      roundedRect(ctx, x, y, layout.tileW, layout.tileH, 6);
      if (entry) {
        ctx.fillStyle = COLORS.tile;
        ctx.fill();
        ctx.clip();
        const img = images[slot];
        if (img) drawCover(ctx, img, x, y, layout.tileW, layout.tileH);
        else drawPlaceholderTitle(ctx, entry.item.title, x, y, layout.tileW, layout.tileH);
      } else {
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = COLORS.empty;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    if (layout.textX !== null) {
      let line = 0;
      for (let c = 0; c < cols; c++) {
        const entry = shown[r * cols + c];
        if (!entry) continue;
        const label = labelFor(display, r * cols + c + 1, entry.item)!;
        let x = layout.textX;
        const baseline = y + 18 + line * CHART.line;
        const right = layout.textX + CHART.textWidth;
        if (label.number) {
          ctx.font = `500 16px ${FONT}`;
          ctx.fillStyle = COLORS.muted;
          ctx.fillText(label.number, x, baseline);
          x += ctx.measureText(label.number).width + 6;
        }
        if (label.title) {
          ctx.font = `600 16px ${FONT}`;
          ctx.fillStyle = COLORS.text;
          const t = fit(ctx, label.title, right - x);
          ctx.fillText(t, x, baseline);
          x += ctx.measureText(t).width;
        }
        if (label.creator && right - x > 40) {
          const text = label.title ? ` · ${label.creator}` : label.creator;
          ctx.font = label.title ? `400 16px ${FONT}` : `600 16px ${FONT}`;
          ctx.fillStyle = label.title ? COLORS.muted : COLORS.text;
          ctx.fillText(fit(ctx, text, right - x), x, baseline);
        }
        line++;
      }
    }
  }

  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText("Made with TierMade", CHART.pad, layout.height - CHART.pad + 4);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image"))), "image/png"),
  );
}

import { describe, expect, it } from "vitest";
import { CHART, computeChartLayout } from "@/lib/chart-image";
import { isAllowedCoverUrl } from "@/lib/images";
import { labelFor } from "@/lib/list-display";

const display = { gridColumns: 3, gridRows: 2, showNumbers: true, showTitles: true, showCreators: true };
const filled = (n: number, total = 6) => Array.from({ length: total }, (_, i) => (i < n ? {} : null));

describe("computeChartLayout", () => {
  it("adds a text column when labels are on, and drops it when they're off", () => {
    const withText = computeChartLayout(display, filled(6), "square");
    const gridW = 3 * CHART.tile + 2 * CHART.gap;
    expect(withText.width).toBe(CHART.pad * 2 + gridW + CHART.textGap + CHART.textWidth);
    expect(withText.textX).toBe(CHART.pad + gridW + CHART.textGap);

    const coversOnly = computeChartLayout({ ...display, showTitles: false, showCreators: false }, filled(6), "square");
    expect(coversOnly.width).toBe(CHART.pad * 2 + gridW);
    expect(coversOnly.textX).toBeNull();
  });

  it("uses 2:3 tiles for portrait covers and stacks rows top to bottom", () => {
    const l = computeChartLayout(display, filled(6), "portrait");
    expect([l.tileW, l.tileH]).toEqual([200, 300]);
    expect(l.rowTops[1] - l.rowTops[0]).toBe(300 + CHART.gap);
    expect(l.height).toBe(CHART.pad + CHART.header + 2 * 300 + CHART.gap + CHART.footer + CHART.pad);
  });

  it("grows a row when its text is taller than the covers", () => {
    const wide = { ...display, gridColumns: 10, gridRows: 1 };
    const l = computeChartLayout(wide, filled(10, 10), "square");
    expect(l.rowHeights[0]).toBe(Math.max(CHART.tile, 10 * CHART.line));
    // with labels off the row is just the covers
    expect(computeChartLayout({ ...wide, showTitles: false, showCreators: false }, filled(10, 10), "square").rowHeights[0]).toBe(
      CHART.tile,
    );
  });
});

describe("labelFor", () => {
  const item = { title: "Kid A", subtitle: "Radiohead" };
  it("builds the text beside a row from the chosen parts", () => {
    expect(labelFor(display, 10, item)).toEqual({ number: "10.", title: "Kid A", creator: "Radiohead" });
    expect(labelFor({ ...display, showCreators: false }, 10, item)).toEqual({ number: "10.", title: "Kid A", creator: null });
    expect(labelFor({ ...display, showTitles: false, showNumbers: false }, 10, item)).toEqual({
      number: null,
      title: null,
      creator: "Radiohead",
    });
    expect(labelFor({ ...display, showTitles: false, showCreators: false }, 10, item)).toBeNull();
  });
});

describe("isAllowedCoverUrl", () => {
  it("allows only the catalog CDNs over https", () => {
    expect(isAllowedCoverUrl("https://cdn-images.dzcdn.net/images/cover/x/500x500.jpg")).toBe(true);
    expect(isAllowedCoverUrl("https://e-cdns-images.dzcdn.net/images/cover/x.jpg")).toBe(true);
    expect(isAllowedCoverUrl("https://image.tmdb.org/t/p/w342/p.jpg")).toBe(true);
    expect(isAllowedCoverUrl("https://images.igdb.com/igdb/image/upload/t_cover_big/x.jpg")).toBe(true);
    expect(isAllowedCoverUrl("https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/x.jpg")).toBe(true);
    expect(isAllowedCoverUrl("https://anilist.co/x.jpg")).toBe(false);

    expect(isAllowedCoverUrl("http://image.tmdb.org/t/p/w342/p.jpg")).toBe(false);
    expect(isAllowedCoverUrl("https://dzcdn.net.evil.com/x.jpg")).toBe(false);
    expect(isAllowedCoverUrl("https://evil.com/dzcdn.net/x.jpg")).toBe(false);
    expect(isAllowedCoverUrl("https://image.tmdb.org:8443/x.jpg")).toBe(false);
    expect(isAllowedCoverUrl("https://user@image.tmdb.org/x.jpg")).toBe(false);
    expect(isAllowedCoverUrl("https://localhost/x.jpg")).toBe(false);
    expect(isAllowedCoverUrl("https://127.0.0.1/x.jpg")).toBe(false);
    expect(isAllowedCoverUrl("/api/images/123")).toBe(false);
    expect(isAllowedCoverUrl("not a url")).toBe(false);
  });
});

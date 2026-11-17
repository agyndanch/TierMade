/** How a ranked list is laid out. Client-safe (no server imports). */
export const LIST_VIEWS = ["list", "grid"] as const;
export type ListView = (typeof LIST_VIEWS)[number];

export const GRID_MIN = 1;
export const GRID_MAX = 10;

export type ListDisplay = {
  view: ListView;
  gridColumns: number;
  gridRows: number;
  /** grid view: what the text beside each row shows */
  showNumbers: boolean;
  showTitles: boolean;
  showCreators: boolean;
};

export const DEFAULT_DISPLAY: ListDisplay = {
  view: "grid",
  gridColumns: 5,
  gridRows: 5,
  showNumbers: true,
  showTitles: true,
  showCreators: true,
};

export const clampGrid = (n: number) => Math.min(GRID_MAX, Math.max(GRID_MIN, Math.round(n)));

/** Grid view shows a text column beside the covers only when there's text to show. */
export const labelsShown = (d: Pick<ListDisplay, "showTitles" | "showCreators">) => d.showTitles || d.showCreators;

/** The text for one item beside the grid, e.g. "10. Title · Artist" (null when labels are off). */
export function labelFor(
  d: Pick<ListDisplay, "showNumbers" | "showTitles" | "showCreators">,
  rank: number,
  item: { title: string; subtitle: string | null },
): { number: string | null; title: string | null; creator: string | null } | null {
  if (!labelsShown(d)) return null;
  const title = d.showTitles ? item.title : null;
  const creator = d.showCreators ? item.subtitle : null;
  if (!title && !creator) return { number: d.showNumbers ? `${rank}.` : null, title: null, creator: null };
  return { number: d.showNumbers ? `${rank}.` : null, title, creator };
}

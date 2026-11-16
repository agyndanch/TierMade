/** How a ranked list is laid out. Client-safe (no server imports). */
export const LIST_VIEWS = ["list", "grid"] as const;
export type ListView = (typeof LIST_VIEWS)[number];

export const GRID_MIN = 1;
export const GRID_MAX = 10;

export type ListDisplay = {
  view: ListView;
  gridColumns: number;
  gridRows: number;
  showNumbers: boolean;
};

export const DEFAULT_DISPLAY: ListDisplay = { view: "list", gridColumns: 5, gridRows: 5, showNumbers: true };

export const clampGrid = (n: number) => Math.min(GRID_MAX, Math.max(GRID_MIN, Math.round(n)));

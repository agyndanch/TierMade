// Client-safe category metadata. Server-only adapters live in ./registry.ts.

export const CATEGORY_IDS = ["albums", "songs", "games", "films", "tv"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export type CategoryInfo = {
  id: CategoryId;
  label: string;
  /** singular noun for UI copy: "Search for an album" */
  noun: string;
  /** cover aspect ratio for cards */
  aspect: "square" | "portrait";
  source: "deezer" | "igdb" | "tmdb";
  placeholder: string;
};

export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  albums: {
    id: "albums",
    label: "Albums",
    noun: "album",
    aspect: "square",
    source: "deezer",
    placeholder: "e.g. Blonde, Rumours, OK Computer",
  },
  songs: {
    id: "songs",
    label: "Songs",
    noun: "song",
    aspect: "square",
    source: "deezer",
    placeholder: "e.g. Bohemian Rhapsody",
  },
  games: {
    id: "games",
    label: "Video games",
    noun: "game",
    aspect: "portrait",
    source: "igdb",
    placeholder: "e.g. Hollow Knight, Zelda",
  },
  films: {
    id: "films",
    label: "Films",
    noun: "film",
    aspect: "portrait",
    source: "tmdb",
    placeholder: "e.g. Inception, Spirited Away",
  },
  tv: {
    id: "tv",
    label: "TV shows",
    noun: "show",
    aspect: "portrait",
    source: "tmdb",
    placeholder: "e.g. The Bear, Breaking Bad",
  },
};

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

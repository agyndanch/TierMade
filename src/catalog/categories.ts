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
  /** label for the creator field when adding a custom item */
  creatorLabel: string;
};

export const CATEGORIES: Record<CategoryId, CategoryInfo> = {
  albums: {
    id: "albums",
    label: "Albums",
    noun: "album",
    aspect: "square",
    source: "deezer",
    placeholder: "e.g. Blonde, Rumours, OK Computer",
    creatorLabel: "Artist",
  },
  songs: {
    id: "songs",
    label: "Songs",
    noun: "song",
    aspect: "square",
    source: "deezer",
    placeholder: "e.g. Bohemian Rhapsody",
    creatorLabel: "Artist",
  },
  games: {
    id: "games",
    label: "Video games",
    noun: "game",
    aspect: "portrait",
    source: "igdb",
    placeholder: "e.g. Hollow Knight, Zelda",
    creatorLabel: "Developer",
  },
  films: {
    id: "films",
    label: "Films",
    noun: "film",
    aspect: "portrait",
    source: "tmdb",
    placeholder: "e.g. Inception, Spirited Away",
    creatorLabel: "Director",
  },
  tv: {
    id: "tv",
    label: "TV shows",
    noun: "show",
    aspect: "portrait",
    source: "tmdb",
    placeholder: "e.g. The Bear, Breaking Bad",
    creatorLabel: "Creator",
  },
};

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

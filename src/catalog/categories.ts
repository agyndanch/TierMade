// Client-safe category metadata. Server-only adapters live in ./registry.ts.

/** Categories backed by one external catalog (each has an adapter). */
export const CATALOG_CATEGORY_IDS = ["albums", "songs", "games", "films", "tv", "anime", "manga"] as const;
export type CatalogCategoryId = (typeof CATALOG_CATEGORY_IDS)[number];

/** All list categories: the catalog ones plus "anything", which mixes every source. */
export const CATEGORY_IDS = [...CATALOG_CATEGORY_IDS, "anything"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export type CategoryInfo = {
  id: CategoryId;
  label: string;
  /** singular noun for UI copy: "Search for an album" */
  noun: string;
  /** cover aspect ratio for cards (square tiles fit images inside, so posters aren't cropped) */
  aspect: "square" | "portrait";
  /** "mixed": items come from any catalog source */
  source: "deezer" | "igdb" | "tmdb" | "anilist" | "mixed";
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
  anime: {
    id: "anime",
    label: "Anime",
    noun: "anime",
    aspect: "portrait",
    source: "anilist",
    placeholder: "e.g. Frieren, Cowboy Bebop",
    creatorLabel: "Studio",
  },
  manga: {
    id: "manga",
    label: "Manga",
    noun: "manga",
    aspect: "portrait",
    source: "anilist",
    placeholder: "e.g. Berserk, Vagabond",
    creatorLabel: "Author",
  },
  anything: {
    id: "anything",
    label: "Anything",
    noun: "anything",
    aspect: "square",
    source: "mixed",
    placeholder: "Pick a source, then search: an album, a game, a film…",
    creatorLabel: "Creator",
  },
};

export function isCatalogCategory(value: unknown): value is CatalogCategoryId {
  return typeof value === "string" && (CATALOG_CATEGORY_IDS as readonly string[]).includes(value);
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

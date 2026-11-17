import "server-only";
import type { CatalogCategoryId } from "./categories";
import type { CatalogAdapter } from "./types";
import { withCache } from "./cache";
import { createDeezerAlbumAdapter, createDeezerTrackAdapter } from "./adapters/deezer";
import { createTmdbMovieAdapter, createTmdbTvAdapter } from "./adapters/tmdb";
import { createIgdbAdapter } from "./adapters/igdb";
import { createAniListAnimeAdapter, createAniListMangaAdapter } from "./adapters/anilist";

/**
 * Catalog category → adapter. Adding a category = add an entry here (plus its
 * metadata in categories.ts). "anything" lists have no adapter of their own:
 * each item is searched and added through its source's category.
 */
const ADAPTERS: Record<CatalogCategoryId, CatalogAdapter> = {
  albums: withCache(createDeezerAlbumAdapter(), "albums"),
  songs: withCache(createDeezerTrackAdapter(), "songs"),
  games: withCache(createIgdbAdapter(), "games"),
  films: withCache(createTmdbMovieAdapter(), "films"),
  tv: withCache(createTmdbTvAdapter(), "tv"),
  anime: withCache(createAniListAnimeAdapter(), "anime"),
  manga: withCache(createAniListMangaAdapter(), "manga"),
};

export function getAdapter(category: CatalogCategoryId): CatalogAdapter {
  return ADAPTERS[category];
}

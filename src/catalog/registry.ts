import "server-only";
import type { CategoryId } from "./categories";
import type { CatalogAdapter } from "./types";
import { withCache } from "./cache";
import { createDeezerAlbumAdapter, createDeezerTrackAdapter } from "./adapters/deezer";
import { createTmdbMovieAdapter, createTmdbTvAdapter } from "./adapters/tmdb";
import { createIgdbAdapter } from "./adapters/igdb";

/**
 * Category → adapter. Adding a category = add an entry here (plus its
 * metadata in categories.ts). Nothing else in the app changes.
 */
const ADAPTERS: Record<CategoryId, CatalogAdapter> = {
  albums: withCache(createDeezerAlbumAdapter(), "albums"),
  songs: withCache(createDeezerTrackAdapter(), "songs"),
  games: withCache(createIgdbAdapter(), "games"),
  films: withCache(createTmdbMovieAdapter(), "films"),
  tv: withCache(createTmdbTvAdapter(), "tv"),
};

export function getAdapter(category: CategoryId): CatalogAdapter {
  return ADAPTERS[category];
}

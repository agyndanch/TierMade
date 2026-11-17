import { CatalogError, type CatalogAdapter, type CatalogResult } from "../types";

/**
 * AniList (https://anilist.co) public GraphQL API: anime and manga, no key.
 * Titles: English when there is one, otherwise romaji (the romaji is kept as
 * metadata.altTitle so search results can show it). Adult titles are excluded.
 */
const ENDPOINT = "https://graphql.anilist.co";

type MediaType = "ANIME" | "MANGA";

export type AniListMedia = {
  id: number;
  isAdult?: boolean | null;
  title: { english?: string | null; romaji?: string | null; native?: string | null };
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  startDate?: { year?: number | null } | null;
  format?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  studios?: { nodes: { name: string; isAnimationStudio?: boolean | null }[] } | null;
  staff?: { edges: { role?: string | null; node: { name: { full?: string | null } } }[] } | null;
};

const MEDIA_FIELDS = `
  id
  isAdult
  title { english romaji native }
  coverImage { extraLarge large }
  startDate { year }
  format
  episodes
  chapters
  studios(isMain: true) { nodes { name isAnimationStudio } }
  staff(sort: RELEVANCE, perPage: 6) { edges { role node { name { full } } } }
`;

export const SEARCH_QUERY = `
query ($search: String, $type: MediaType, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(search: $search, type: $type, isAdult: false, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
  }
}`;

export const ITEM_QUERY = `
query ($id: Int, $type: MediaType) {
  Media(id: $id, type: $type) { ${MEDIA_FIELDS} }
}`;

/** Studio for anime; the story author for manga (falls back to the first credited person). */
function creatorOf(m: AniListMedia, type: MediaType): string | undefined {
  if (type === "ANIME") {
    const studios = m.studios?.nodes ?? [];
    return (studios.find((s) => s.isAnimationStudio) ?? studios[0])?.name || undefined;
  }
  const edges = m.staff?.edges ?? [];
  const story = edges.find((e) => /story/i.test(e.role ?? ""));
  return (story ?? edges[0])?.node.name.full || undefined;
}

export function mapAniListMedia(m: AniListMedia, type: MediaType): CatalogResult {
  const english = m.title.english?.trim() || null;
  const romaji = m.title.romaji?.trim() || null;
  const title = english ?? romaji ?? m.title.native ?? "Untitled";
  // Only worth showing when it isn't just the same words in different case/punctuation.
  const letters = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const altTitle = romaji && letters(romaji) !== letters(title) ? romaji : undefined;
  return {
    externalId: String(m.id),
    title,
    subtitle: creatorOf(m, type),
    year: m.startDate?.year ?? undefined,
    imageUrl: m.coverImage?.extraLarge ?? m.coverImage?.large ?? undefined,
    metadata: {
      altTitle,
      native: m.title.native ?? undefined,
      format: m.format ?? undefined,
      ...(type === "ANIME" ? { episodes: m.episodes ?? undefined } : { chapters: m.chapters ?? undefined }),
    },
  };
}

async function aniListQuery<T>(query: string, variables: Record<string, unknown>, fetchImpl: typeof fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new CatalogError("Couldn't reach AniList");
  }
  if (res.status === 429) throw new CatalogError("AniList is busy. Try again in a minute", 503);
  const body = (await res.json().catch(() => null)) as { data?: T; errors?: { status?: number }[] } | null;
  // AniList reports a missing Media as an error with status 404.
  if (body?.errors?.some((e) => e.status === 404)) return { Media: null } as T;
  if (!res.ok || !body?.data) throw new CatalogError(`AniList responded ${res.status}`);
  return body.data;
}

function createAniListAdapter(type: MediaType, fetchImpl: typeof fetch): CatalogAdapter {
  return {
    source: "anilist",
    async search(query, limit = 20) {
      const data = await aniListQuery<{ Page: { media: AniListMedia[] } }>(
        SEARCH_QUERY,
        { search: query, type, perPage: limit },
        fetchImpl,
      );
      return (data.Page?.media ?? []).filter((m) => !m.isAdult).map((m) => mapAniListMedia(m, type));
    },
    async getItem(externalId) {
      if (!/^\d+$/.test(externalId)) return null;
      const data = await aniListQuery<{ Media: AniListMedia | null }>(
        ITEM_QUERY,
        { id: Number(externalId), type },
        fetchImpl,
      );
      if (!data.Media || data.Media.isAdult) return null;
      return mapAniListMedia(data.Media, type);
    },
  };
}

export const createAniListAnimeAdapter = (fetchImpl: typeof fetch = fetch) => createAniListAdapter("ANIME", fetchImpl);
export const createAniListMangaAdapter = (fetchImpl: typeof fetch = fetch) => createAniListAdapter("MANGA", fetchImpl);

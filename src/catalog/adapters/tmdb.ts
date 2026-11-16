import {
  CatalogConfigError,
  CatalogError,
  yearFromDate,
  type CatalogAdapter,
  type CatalogResult,
} from "../types";

const BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

type TmdbMovie = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
};
type TmdbShow = {
  id: number;
  name: string;
  original_name?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
};

type Kind = "movie" | "tv";

async function tmdbGet<T>(path: string, fetchImpl: typeof fetch, token: string): Promise<T> {
  const res = await fetchImpl(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 404) throw new CatalogError("Not found", 404);
  if (!res.ok) throw new CatalogError(`TMDB responded ${res.status}`);
  return (await res.json()) as T;
}

export function mapTmdbMovie(m: TmdbMovie): CatalogResult {
  return {
    externalId: String(m.id),
    title: m.title,
    subtitle: m.original_title && m.original_title !== m.title ? m.original_title : undefined,
    year: yearFromDate(m.release_date),
    imageUrl: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : undefined,
    metadata: { overview: m.overview },
  };
}

export function mapTmdbShow(s: TmdbShow): CatalogResult {
  return {
    externalId: String(s.id),
    title: s.name,
    subtitle: s.original_name && s.original_name !== s.name ? s.original_name : undefined,
    year: yearFromDate(s.first_air_date),
    imageUrl: s.poster_path ? `${IMAGE_BASE}${s.poster_path}` : undefined,
    metadata: { overview: s.overview },
  };
}

function createTmdbAdapter(kind: Kind, fetchImpl: typeof fetch): CatalogAdapter {
  const map = (raw: unknown) => (kind === "movie" ? mapTmdbMovie(raw as TmdbMovie) : mapTmdbShow(raw as TmdbShow));
  const token = () => {
    const t = process.env.TMDB_API_TOKEN;
    if (!t) throw new CatalogConfigError("TMDB_API_TOKEN");
    return t;
  };
  return {
    source: "tmdb",
    async search(query, limit = 20) {
      const q = encodeURIComponent(query);
      const body = await tmdbGet<{ results: unknown[] }>(
        `/search/${kind}?query=${q}&include_adult=false&page=1`,
        fetchImpl,
        token(),
      );
      return (body.results ?? []).slice(0, limit).map(map);
    },
    async getItem(externalId) {
      if (!/^\d+$/.test(externalId)) return null;
      try {
        return map(await tmdbGet<unknown>(`/${kind}/${externalId}`, fetchImpl, token()));
      } catch (e) {
        if (e instanceof CatalogError && e.status === 404) return null;
        throw e;
      }
    },
  };
}

export const createTmdbMovieAdapter = (fetchImpl: typeof fetch = fetch) => createTmdbAdapter("movie", fetchImpl);
export const createTmdbTvAdapter = (fetchImpl: typeof fetch = fetch) => createTmdbAdapter("tv", fetchImpl);

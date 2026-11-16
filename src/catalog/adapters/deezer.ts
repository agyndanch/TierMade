import { CatalogError, yearFromDate, type CatalogAdapter, type CatalogResult } from "../types";

const BASE = "https://api.deezer.com";

type DeezerArtist = { id: number; name: string };
type DeezerAlbum = {
  id: number;
  title: string;
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
  release_date?: string;
  record_type?: string;
  nb_tracks?: number;
  artist?: DeezerArtist;
};
type DeezerTrack = {
  id: number;
  title: string;
  duration?: number;
  release_date?: string;
  artist?: DeezerArtist;
  album?: DeezerAlbum;
};

async function deezerGet<T>(path: string, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new CatalogError(`Deezer responded ${res.status}`);
  const body = (await res.json()) as T & { error?: { message?: string; code?: number } };
  // Deezer reports errors with HTTP 200 + an `error` object.
  if (body && typeof body === "object" && "error" in body && body.error) {
    if (body.error.code === 800) throw new CatalogError("Not found", 404);
    throw new CatalogError(`Deezer error: ${body.error.message ?? "unknown"}`);
  }
  return body;
}

export function mapDeezerAlbum(a: DeezerAlbum): CatalogResult {
  return {
    externalId: String(a.id),
    title: a.title,
    subtitle: a.artist?.name,
    year: yearFromDate(a.release_date),
    imageUrl: a.cover_big ?? a.cover_medium ?? undefined,
    metadata: { recordType: a.record_type, tracks: a.nb_tracks },
  };
}

export function mapDeezerTrack(t: DeezerTrack): CatalogResult {
  return {
    externalId: String(t.id),
    title: t.title,
    subtitle: [t.artist?.name, t.album?.title].filter(Boolean).join(" · ") || undefined,
    year: yearFromDate(t.release_date ?? t.album?.release_date),
    imageUrl: t.album?.cover_big ?? t.album?.cover_medium ?? undefined,
    metadata: { duration: t.duration, album: t.album?.title },
  };
}

export function createDeezerAlbumAdapter(fetchImpl: typeof fetch = fetch): CatalogAdapter {
  return {
    source: "deezer",
    async search(query, limit = 20) {
      const q = encodeURIComponent(query);
      const body = await deezerGet<{ data: DeezerAlbum[] }>(`/search/album?q=${q}&limit=${limit}`, fetchImpl);
      return (body.data ?? []).map(mapDeezerAlbum);
    },
    async getItem(externalId) {
      if (!/^\d+$/.test(externalId)) return null;
      try {
        return mapDeezerAlbum(await deezerGet<DeezerAlbum>(`/album/${externalId}`, fetchImpl));
      } catch (e) {
        if (e instanceof CatalogError && e.status === 404) return null;
        throw e;
      }
    },
  };
}

export function createDeezerTrackAdapter(fetchImpl: typeof fetch = fetch): CatalogAdapter {
  return {
    source: "deezer",
    async search(query, limit = 20) {
      const q = encodeURIComponent(query);
      const body = await deezerGet<{ data: DeezerTrack[] }>(`/search/track?q=${q}&limit=${limit}`, fetchImpl);
      return (body.data ?? []).map(mapDeezerTrack);
    },
    async getItem(externalId) {
      if (!/^\d+$/.test(externalId)) return null;
      try {
        return mapDeezerTrack(await deezerGet<DeezerTrack>(`/track/${externalId}`, fetchImpl));
      } catch (e) {
        if (e instanceof CatalogError && e.status === 404) return null;
        throw e;
      }
    },
  };
}

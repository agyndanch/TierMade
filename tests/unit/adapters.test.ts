import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDeezerAlbumAdapter, createDeezerTrackAdapter } from "@/catalog/adapters/deezer";
import { createTmdbMovieAdapter, createTmdbTvAdapter } from "@/catalog/adapters/tmdb";
import { createIgdbAdapter } from "@/catalog/adapters/igdb";
import { createAniListAnimeAdapter, createAniListMangaAdapter } from "@/catalog/adapters/anilist";
import { withCache } from "@/catalog/cache";
import { CatalogConfigError, CatalogError } from "@/catalog/types";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Deezer adapters", () => {
  it("maps album search results", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: [
          { id: 302127, title: "Discovery", cover_big: "https://e-cdns-images.dzcdn.net/big.jpg", artist: { id: 27, name: "Daft Punk" }, record_type: "album" },
        ],
      }),
    );
    const results = await createDeezerAlbumAdapter(fetchMock as unknown as typeof fetch).search("discovery");
    expect(fetchMock).toHaveBeenCalledWith("https://api.deezer.com/search/album?q=discovery&limit=20", expect.anything());
    expect(results).toEqual([
      {
        externalId: "302127",
        title: "Discovery",
        subtitle: "Daft Punk",
        year: undefined,
        imageUrl: "https://e-cdns-images.dzcdn.net/big.jpg",
        metadata: { recordType: "album", tracks: undefined },
      },
    ]);
  });

  it("maps a track lookup with artist and album", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        id: 3135556,
        title: "Harder, Better, Faster, Stronger",
        release_date: "2001-03-07",
        duration: 224,
        artist: { id: 27, name: "Daft Punk" },
        album: { id: 302127, title: "Discovery", cover_medium: "m.jpg" },
      }),
    );
    const item = await createDeezerTrackAdapter(fetchMock as unknown as typeof fetch).getItem("3135556");
    expect(item).toMatchObject({
      externalId: "3135556",
      subtitle: "Daft Punk · Discovery",
      year: 2001,
      imageUrl: "m.jpg",
    });
  });

  it("treats Deezer's 200-with-error 'not found' as null", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: { type: "DataException", message: "no data", code: 800 } }));
    expect(await createDeezerAlbumAdapter(fetchMock as unknown as typeof fetch).getItem("1")).toBeNull();
  });

  it("rejects non-numeric ids without calling the API", async () => {
    const fetchMock = vi.fn();
    expect(await createDeezerAlbumAdapter(fetchMock as unknown as typeof fetch).getItem("../etc")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("TMDB adapters", () => {
  beforeEach(() => vi.stubEnv("TMDB_API_TOKEN", "test-token"));
  afterEach(() => vi.unstubAllEnvs());

  it("maps movie search results and sends the bearer token", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        results: [
          { id: 27205, title: "Inception", original_title: "Inception", release_date: "2010-07-15", poster_path: "/p.jpg" },
          { id: 129, title: "Spirited Away", original_title: "千と千尋の神隠し", release_date: "2001-07-20", poster_path: null },
        ],
      }),
    );
    const results = await createTmdbMovieAdapter(fetchMock as unknown as typeof fetch).search("inception");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(results[0]).toMatchObject({
      externalId: "27205",
      title: "Inception",
      subtitle: undefined,
      year: 2010,
      imageUrl: "https://image.tmdb.org/t/p/w342/p.jpg",
    });
    expect(results[1]).toMatchObject({ subtitle: "千と千尋の神隠し", imageUrl: undefined });
  });

  it("maps TV shows from the tv endpoint", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 1396, name: "Breaking Bad", first_air_date: "2008-01-20", poster_path: "/bb.jpg" }));
    const show = await createTmdbTvAdapter(fetchMock as unknown as typeof fetch).getItem("1396");
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe("https://api.themoviedb.org/3/tv/1396");
    expect(show).toMatchObject({ title: "Breaking Bad", year: 2008 });
  });

  it("returns null on 404", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 404));
    expect(await createTmdbMovieAdapter(fetchMock as unknown as typeof fetch).getItem("999999999")).toBeNull();
  });

  it("throws a config error when the token is missing", async () => {
    vi.stubEnv("TMDB_API_TOKEN", "");
    await expect(createTmdbMovieAdapter(vi.fn() as unknown as typeof fetch).search("x")).rejects.toBeInstanceOf(
      CatalogConfigError,
    );
  });
});

describe("IGDB adapter", () => {
  beforeEach(() => {
    vi.stubEnv("TWITCH_CLIENT_ID", "cid");
    vi.stubEnv("TWITCH_CLIENT_SECRET", "secret");
  });
  afterEach(() => vi.unstubAllEnvs());

  const game = {
    id: 1942,
    name: "The Witcher 3: Wild Hunt",
    first_release_date: 1431993600,
    cover: { image_id: "co1wyy" },
    platforms: [{ abbreviation: "PC" }, { abbreviation: "PS4" }],
    involved_companies: [
      { developer: false, company: { name: "Bandai Namco" } },
      { developer: true, company: { name: "CD Projekt RED" } },
    ],
  };

  it("fetches a token once, then maps games", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith("https://id.twitch.tv") ? jsonResponse({ access_token: "tok", expires_in: 3600 }) : jsonResponse([game]),
    );
    const adapter = createIgdbAdapter(fetchMock as unknown as typeof fetch, 0);
    const [first] = await adapter.search("witcher");
    await adapter.search("zelda");

    const tokenCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("twitch"));
    expect(tokenCalls).toHaveLength(1);
    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.body).toContain('search "witcher";');
    expect((init.headers as Record<string, string>)["Client-ID"]).toBe("cid");
    expect(first).toEqual({
      externalId: "1942",
      title: "The Witcher 3: Wild Hunt",
      subtitle: "CD Projekt RED",
      year: 2015,
      imageUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
      metadata: { platforms: ["PC", "PS4"] },
    });
  });

  it("refreshes the token after a 401 and retries once", async () => {
    let gameCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://id.twitch.tv")) return jsonResponse({ access_token: `tok`, expires_in: 3600 });
      gameCalls++;
      return gameCalls === 1 ? jsonResponse({}, 401) : jsonResponse([game]);
    });
    const adapter = createIgdbAdapter(fetchMock as unknown as typeof fetch, 0);
    expect(await adapter.getItem("1942")).toMatchObject({ title: "The Witcher 3: Wild Hunt" });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("twitch"))).toHaveLength(2);
  });

  it("strips quotes from search input", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith("https://id.twitch.tv") ? jsonResponse({ access_token: "tok", expires_in: 3600 }) : jsonResponse([]),
    );
    await createIgdbAdapter(fetchMock as unknown as typeof fetch, 0).search('zelda"; fields *;');
    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.body).toMatch(/^search "zelda ; fields \*;";/);
  });
});

describe("AniList adapters", () => {
  const titan = {
    id: 16498,
    isAdult: false,
    title: { english: "Attack on Titan", romaji: "Shingeki no Kyojin", native: "進撃の巨人" },
    coverImage: { extraLarge: "https://s4.anilist.co/file/xl.jpg", large: "https://s4.anilist.co/file/l.jpg" },
    startDate: { year: 2013 },
    format: "TV",
    episodes: 25,
    studios: { nodes: [{ name: "Pony Canyon", isAnimationStudio: false }, { name: "Wit Studio", isAnimationStudio: true }] },
    staff: { edges: [] },
  };
  const berserk = {
    id: 30002,
    isAdult: false,
    title: { english: null, romaji: "Berserk", native: "ベルセルク" },
    coverImage: { extraLarge: null, large: "https://s4.anilist.co/file/b.jpg" },
    startDate: { year: 1989 },
    format: "MANGA",
    chapters: null,
    studios: { nodes: [] },
    staff: {
      edges: [
        { role: "Assistant", node: { name: { full: "Someone Else" } } },
        { role: "Story & Art", node: { name: { full: "Kentarou Miura" } } },
      ],
    },
  };

  it("searches anime with a variables-only GraphQL POST and maps English titles + studio", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: { Page: { media: [titan] } } }));
    const [result] = await createAniListAnimeAdapter(fetchMock as unknown as typeof fetch).search('titan"){}', 10);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graphql.anilist.co");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.variables).toEqual({ search: 'titan"){}', type: "ANIME", perPage: 10 });
    expect(body.query).toContain("isAdult: false");
    expect(body.query).not.toContain("titan"); // user input never goes into the query text

    expect(result).toEqual({
      externalId: "16498",
      title: "Attack on Titan",
      subtitle: "Wit Studio",
      year: 2013,
      imageUrl: "https://s4.anilist.co/file/xl.jpg",
      metadata: { altTitle: "Shingeki no Kyojin", native: "進撃の巨人", format: "TV", episodes: 25 },
    });
  });

  it("falls back to romaji, uses the story author for manga, and the large cover", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: { Media: berserk } }));
    const item = await createAniListMangaAdapter(fetchMock as unknown as typeof fetch).getItem("30002");
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)).variables).toEqual({
      id: 30002,
      type: "MANGA",
    });
    expect(item).toMatchObject({
      title: "Berserk",
      subtitle: "Kentarou Miura",
      year: 1989,
      imageUrl: "https://s4.anilist.co/file/b.jpg",
    });
    expect(item!.metadata!.altTitle).toBeUndefined(); // romaji is already the title
  });

  it("skips a romaji line that only differs in case or punctuation", async () => {
    const proto = { ...berserk, title: { english: "Berserk: The Prototype", romaji: "BERSERK THE PROTOTYPE", native: null } };
    const fetchMock = vi.fn(async () => jsonResponse({ data: { Media: proto } }));
    const item = await createAniListMangaAdapter(fetchMock as unknown as typeof fetch).getItem("1");
    expect(item!.metadata!.altTitle).toBeUndefined();
  });

  it("returns null for bad ids, missing or adult items, and maps 429 to a 503", async () => {
    const never = vi.fn();
    expect(await createAniListMangaAdapter(never as unknown as typeof fetch).getItem("../x")).toBeNull();
    expect(never).not.toHaveBeenCalled();

    const missing = vi.fn(async () => jsonResponse({ data: { Media: null }, errors: [{ status: 404, message: "Not Found." }] }, 404));
    expect(await createAniListAnimeAdapter(missing as unknown as typeof fetch).getItem("999999999")).toBeNull();

    const adult = vi.fn(async () => jsonResponse({ data: { Media: { ...titan, isAdult: true } } }));
    expect(await createAniListAnimeAdapter(adult as unknown as typeof fetch).getItem("1")).toBeNull();

    const busy = vi.fn(async () => jsonResponse({}, 429));
    const err = await createAniListAnimeAdapter(busy as unknown as typeof fetch).search("x").catch((e) => e);
    expect(err).toBeInstanceOf(CatalogError);
    expect((err as CatalogError).status).toBe(503);
  });
});

describe("withCache", () => {
  it("serves repeated searches and post-search lookups from memory", async () => {
    const inner = {
      source: "deezer" as const,
      search: vi.fn(async () => [{ externalId: "1", title: "One" }]),
      getItem: vi.fn(async () => ({ externalId: "1", title: "One" })),
    };
    const cached = withCache(inner, "t");
    await cached.search("abc");
    await cached.search("  ABC ");
    expect(inner.search).toHaveBeenCalledTimes(1);
    expect(await cached.getItem("1")).toEqual({ externalId: "1", title: "One" });
    expect(inner.getItem).not.toHaveBeenCalled();
  });
});

import { CatalogConfigError, CatalogError, type CatalogAdapter, type CatalogResult } from "../types";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const GAMES_URL = "https://api.igdb.com/v4/games";
const COVER_BASE = "https://images.igdb.com/igdb/image/upload/t_cover_big";
const FIELDS =
  "fields name, first_release_date, cover.image_id, platforms.abbreviation, involved_companies.developer, involved_companies.company.name;";

type IgdbGame = {
  id: number;
  name: string;
  first_release_date?: number;
  cover?: { image_id?: string };
  platforms?: { abbreviation?: string }[];
  involved_companies?: { developer?: boolean; company?: { name?: string } }[];
};

export function mapIgdbGame(g: IgdbGame): CatalogResult {
  const developer = g.involved_companies?.find((c) => c.developer)?.company?.name;
  const platforms = (g.platforms ?? []).map((p) => p.abbreviation).filter(Boolean) as string[];
  return {
    externalId: String(g.id),
    title: g.name,
    subtitle: developer,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : undefined,
    imageUrl: g.cover?.image_id ? `${COVER_BASE}/${g.cover.image_id}.jpg` : undefined,
    metadata: platforms.length ? { platforms } : undefined,
  };
}

/** IGDB allows 4 requests/second; space calls at least 260ms apart. */
function createThrottle(minGapMs: number) {
  let last = Promise.resolve();
  let lastAt = 0;
  return function throttle<T>(fn: () => Promise<T>): Promise<T> {
    const run = last.then(async () => {
      const wait = lastAt + minGapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastAt = Date.now();
    });
    last = run.catch(() => undefined);
    return run.then(fn);
  };
}

export function createIgdbAdapter(fetchImpl: typeof fetch = fetch, minGapMs = 260): CatalogAdapter {
  let token: { value: string; expiresAt: number } | null = null;
  let tokenPromise: Promise<string> | null = null;
  const throttle = createThrottle(minGapMs);

  function credentials() {
    const id = process.env.TWITCH_CLIENT_ID;
    const secret = process.env.TWITCH_CLIENT_SECRET;
    if (!id) throw new CatalogConfigError("TWITCH_CLIENT_ID");
    if (!secret) throw new CatalogConfigError("TWITCH_CLIENT_SECRET");
    return { id, secret };
  }

  async function getToken(force = false): Promise<string> {
    if (!force && token && token.expiresAt > Date.now() + 60_000) return token.value;
    if (!tokenPromise) {
      const { id, secret } = credentials();
      tokenPromise = (async () => {
        const url = `${TOKEN_URL}?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`;
        const res = await fetchImpl(url, { method: "POST" });
        if (!res.ok) throw new CatalogError(`Twitch token request failed (${res.status})`);
        const body = (await res.json()) as { access_token: string; expires_in: number };
        token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
        return token.value;
      })().finally(() => {
        tokenPromise = null;
      });
    }
    return tokenPromise;
  }

  async function query(body: string, retried = false): Promise<IgdbGame[]> {
    const { id } = credentials();
    const bearer = await getToken(retried);
    const res = await throttle(() =>
      fetchImpl(GAMES_URL, {
        method: "POST",
        headers: { "Client-ID": id, Authorization: `Bearer ${bearer}`, Accept: "application/json" },
        body,
      }),
    );
    if (res.status === 401 && !retried) return query(body, true); // token revoked/expired early
    if (!res.ok) throw new CatalogError(`IGDB responded ${res.status}`);
    return (await res.json()) as IgdbGame[];
  }

  return {
    source: "igdb",
    async search(q, limit = 20) {
      const safe = q.replace(/["\\]/g, " ").trim();
      if (!safe) return [];
      const games = await query(`search "${safe}"; ${FIELDS} where version_parent = null; limit ${limit};`);
      return games.map(mapIgdbGame);
    },
    async getItem(externalId) {
      if (!/^\d+$/.test(externalId)) return null;
      const games = await query(`${FIELDS} where id = ${externalId};`);
      return games[0] ? mapIgdbGame(games[0]) : null;
    },
  };
}

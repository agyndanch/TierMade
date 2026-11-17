export type CatalogSource = "deezer" | "igdb" | "tmdb" | "anilist";

/** The normalized shape every adapter returns. */
export type CatalogResult = {
  externalId: string;
  title: string;
  subtitle?: string;
  year?: number;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
};

/** Adapter pattern: one implementation per external API (or API endpoint). */
export interface CatalogAdapter {
  source: CatalogSource;
  search(query: string, limit?: number): Promise<CatalogResult[]>;
  getItem(externalId: string): Promise<CatalogResult | null>;
}

/** Upstream API failed or returned something unusable. */
export class CatalogError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

/** An adapter is missing its API credentials. */
export class CatalogConfigError extends CatalogError {
  constructor(envVar: string) {
    super(`${envVar} is not configured on the server`, 503);
    this.name = "CatalogConfigError";
  }
}

export function yearFromDate(date: string | null | undefined): number | undefined {
  if (!date) return undefined;
  const y = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) && y > 0 ? y : undefined;
}

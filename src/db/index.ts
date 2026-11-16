import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * DATABASE_URL forms:
 *   postgres://user:pass@host:5432/db   → node-postgres (Docker, Neon, etc.)
 *   pglite://./.data/pglite              → embedded Postgres on disk (local dev, no Docker)
 *   pglite://memory                      → in-memory embedded Postgres (tests)
 */
export function createDb(url: string): DB {
  if (url.startsWith("pglite://")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
    const target = url.slice("pglite://".length);
    const client = target === "memory" ? new PGlite() : new PGlite(target);
    return drizzle(client, { schema }) as unknown as DB;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
  // Small pool: on serverless each instance holds its own (use Neon's pooled URL).
  const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 });
  return drizzle(pool, { schema }) as unknown as DB;
}

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __tiermadeDb?: DB };

function getDb(): DB {
  if (!globalForDb.__tiermadeDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
    globalForDb.__tiermadeDb = createDb(url);
  }
  return globalForDb.__tiermadeDb;
}

/** Lazily-initialised database handle. */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };

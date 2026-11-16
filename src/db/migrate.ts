import path from "node:path";
import type { DB } from "./index";

const migrationsFolder = path.join(process.cwd(), "src", "db", "migrations");

/** Applies all pending SQL migrations from src/db/migrations. */
export async function runMigrations(database: DB, url: string) {
  if (url.startsWith("pglite://")) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(database as any, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(database as any, { migrationsFolder });
  }
}

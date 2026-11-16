import { config } from "dotenv";
config({ path: ".env.local" });
config();

import fs from "node:fs";
import { createDb } from "../src/db";
import { runMigrations } from "../src/db/migrate";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (url.startsWith("pglite://") && url !== "pglite://memory") {
    fs.mkdirSync(url.slice("pglite://".length), { recursive: true });
  }
  const db = createDb(url);
  await runMigrations(db, url);
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only diffs the schema file against previous
// migrations; it never connects to a database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
});

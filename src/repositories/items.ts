import { sql } from "drizzle-orm";
import { db, type DB } from "@/db";
import { items, type Item } from "@/db/schema";
import type { CatalogResult, CatalogSource } from "@/catalog/types";

/** Insert the catalog item, or refresh its metadata if we already have it. */
export async function upsertItem(
  category: string,
  source: CatalogSource,
  r: CatalogResult,
  d: DB = db,
): Promise<Item> {
  const values = {
    category,
    source,
    externalId: r.externalId,
    title: r.title,
    subtitle: r.subtitle ?? null,
    year: r.year ?? null,
    imageUrl: r.imageUrl ?? null,
    metadata: r.metadata ?? null,
  };
  const [row] = await d
    .insert(items)
    .values(values)
    .onConflictDoUpdate({
      target: [items.source, items.category, items.externalId],
      set: {
        title: sql`excluded.title`,
        subtitle: sql`excluded.subtitle`,
        year: sql`excluded.year`,
        imageUrl: sql`excluded.image_url`,
        metadata: sql`excluded.metadata`,
      },
    })
    .returning();
  return row;
}

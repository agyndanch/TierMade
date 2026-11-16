import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { db, type DB } from "@/db";
import { items, listEntries, type Item } from "@/db/schema";
import type { CatalogResult, CatalogSource } from "@/catalog/types";
import { imageIdFromUrl } from "@/lib/images";
import { deleteImage } from "./images";

export const CUSTOM_SOURCE = "custom";

/** A user-made item: always a new row, never shared with catalog items. */
export async function insertCustomItem(
  input: { category: string; title: string; subtitle: string | null; imageUrl: string | null; createdBy: string },
  d: DB = db,
): Promise<Item> {
  const [row] = await d
    .insert(items)
    .values({ ...input, source: CUSTOM_SOURCE, externalId: crypto.randomUUID() })
    .returning();
  return row;
}

/**
 * Deletes custom items (and their uploaded images) that no list uses any more.
 * Catalog items are left alone; they're a shared cache.
 */
export async function deleteOrphanedCustomItems(itemIds: string[], d: DB = db) {
  if (itemIds.length === 0) return;
  const removed = await d
    .delete(items)
    .where(
      and(
        inArray(items.id, itemIds),
        eq(items.source, CUSTOM_SOURCE),
        notExists(d.select({ one: sql`1` }).from(listEntries).where(eq(listEntries.itemId, items.id))),
      ),
    )
    .returning({ imageUrl: items.imageUrl });
  for (const { imageUrl } of removed) {
    const imageId = imageIdFromUrl(imageUrl);
    if (imageId) await deleteImage(imageId, d);
  }
}

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

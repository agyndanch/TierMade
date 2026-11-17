import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, type DB } from "@/db";
import { items, listEntries, listTiers, type ListTier } from "@/db/schema";

export type EntryWithItem = {
  id: string;
  tierId: string | null;
  position: number;
  /** ranked lists: in the "Not ranked yet" pool */
  unranked: boolean;
  /** the owner's own names for this item in this list (null = the catalog's) */
  customTitle: string | null;
  customSubtitle: string | null;
  item: {
    id: string;
    /** the item's own category (in "anything" lists this differs from the list's) */
    category: string;
    externalId: string;
    /** what this list shows: the custom name if there is one, else the catalog's */
    title: string;
    subtitle: string | null;
    /** the catalog's names */
    originalTitle: string;
    originalSubtitle: string | null;
    year: number | null;
    imageUrl: string | null;
  };
};

export async function tiersForList(listId: string, d: DB = db): Promise<ListTier[]> {
  return d.select().from(listTiers).where(eq(listTiers.listId, listId)).orderBy(asc(listTiers.position));
}

/** Entries in display order: ranked pool last, then by tier position (unsorted last), then position. */
export async function entriesForList(listId: string, d: DB = db): Promise<EntryWithItem[]> {
  const rows = await d
    .select({
      id: listEntries.id,
      tierId: listEntries.tierId,
      position: listEntries.position,
      unranked: listEntries.unranked,
      customTitle: listEntries.displayTitle,
      customSubtitle: listEntries.displaySubtitle,
      item: {
        id: items.id,
        category: items.category,
        externalId: items.externalId,
        title: sql<string>`coalesce(${listEntries.displayTitle}, ${items.title})`,
        subtitle: sql<string | null>`coalesce(${listEntries.displaySubtitle}, ${items.subtitle})`,
        originalTitle: items.title,
        originalSubtitle: items.subtitle,
        year: items.year,
        imageUrl: items.imageUrl,
      },
    })
    .from(listEntries)
    .innerJoin(items, eq(items.id, listEntries.itemId))
    .leftJoin(listTiers, eq(listTiers.id, listEntries.tierId))
    .where(eq(listEntries.listId, listId))
    .orderBy(asc(listEntries.unranked), asc(sql`coalesce(${listTiers.position}, 999)`), asc(listEntries.position));
  return rows;
}

export async function findEntry(listId: string, entryId: string, d: DB = db) {
  const rows = await d
    .select()
    .from(listEntries)
    .where(and(eq(listEntries.listId, listId), eq(listEntries.id, entryId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function entryExistsForItem(listId: string, itemId: string, d: DB = db) {
  const rows = await d
    .select({ id: listEntries.id })
    .from(listEntries)
    .where(and(eq(listEntries.listId, listId), eq(listEntries.itemId, itemId)))
    .limit(1);
  return rows.length > 0;
}

export type Placement = { tierId: string | null; position: number; unranked: boolean };

/**
 * max(position) + 1 within a group: one tier, a tier list's unsorted pool
 * (tierId null), a ranked list's slots, or its "Not ranked yet" pool.
 */
export async function nextPosition(
  listId: string,
  group: { tierId: string | null; unranked: boolean },
  d: DB = db,
): Promise<number> {
  const tierFilter = group.tierId ? eq(listEntries.tierId, group.tierId) : isNull(listEntries.tierId);
  const [{ next }] = await d
    .select({ next: sql<number>`coalesce(max(${listEntries.position}) + 1, 0)::int` })
    .from(listEntries)
    .where(and(eq(listEntries.listId, listId), tierFilter, eq(listEntries.unranked, group.unranked)));
  return Number(next);
}

export async function insertEntry(listId: string, itemId: string, at: Placement, d: DB = db) {
  const [row] = await d
    .insert(listEntries)
    .values({ listId, itemId, ...at })
    .returning();
  return row;
}

/** Sets (or clears, with null) this list's own names for an entry. Returns false if no such entry. */
export async function updateEntryLabels(
  listId: string,
  entryId: string,
  labels: { displayTitle: string | null; displaySubtitle: string | null },
  d: DB = db,
): Promise<boolean> {
  const rows = await d
    .update(listEntries)
    .set(labels)
    .where(and(eq(listEntries.listId, listId), eq(listEntries.id, entryId)))
    .returning({ id: listEntries.id });
  return rows.length > 0;
}

export async function deleteEntry(listId: string, entryId: string, d: DB = db) {
  const rows = await d
    .delete(listEntries)
    .where(and(eq(listEntries.listId, listId), eq(listEntries.id, entryId)))
    .returning({ id: listEntries.id });
  return rows.length > 0;
}

/** Rewrites tier + position (+ pool flag) for every given entry in one transaction. */
export async function applyOrder(
  listId: string,
  order: ({ id: string } & Placement)[],
  d: DB = db,
) {
  await d.transaction(async (tx) => {
    for (const e of order) {
      await tx
        .update(listEntries)
        .set({ tierId: e.tierId, position: e.position, unranked: e.unranked })
        .where(and(eq(listEntries.listId, listId), eq(listEntries.id, e.id)));
    }
  });
}

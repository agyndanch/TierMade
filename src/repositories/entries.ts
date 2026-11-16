import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, type DB } from "@/db";
import { items, listEntries, listTiers, type ListTier } from "@/db/schema";

export type EntryWithItem = {
  id: string;
  tierId: string | null;
  position: number;
  item: {
    id: string;
    externalId: string;
    title: string;
    subtitle: string | null;
    year: number | null;
    imageUrl: string | null;
  };
};

export async function tiersForList(listId: string, d: DB = db): Promise<ListTier[]> {
  return d.select().from(listTiers).where(eq(listTiers.listId, listId)).orderBy(asc(listTiers.position));
}

/** Entries in display order: by tier position (unsorted last), then position. */
export async function entriesForList(listId: string, d: DB = db): Promise<EntryWithItem[]> {
  const rows = await d
    .select({
      id: listEntries.id,
      tierId: listEntries.tierId,
      position: listEntries.position,
      item: {
        id: items.id,
        externalId: items.externalId,
        title: items.title,
        subtitle: items.subtitle,
        year: items.year,
        imageUrl: items.imageUrl,
      },
    })
    .from(listEntries)
    .innerJoin(items, eq(items.id, listEntries.itemId))
    .leftJoin(listTiers, eq(listTiers.id, listEntries.tierId))
    .where(eq(listEntries.listId, listId))
    .orderBy(asc(sql`coalesce(${listTiers.position}, 999)`), asc(listEntries.position));
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

/** Appends the item to the end of its group (the tier, or the whole ranked list). */
export async function appendEntry(listId: string, itemId: string, tierId: string | null, d: DB = db) {
  const groupFilter = tierId ? eq(listEntries.tierId, tierId) : isNull(listEntries.tierId);
  const [{ next }] = await d
    .select({ next: sql<number>`coalesce(max(${listEntries.position}) + 1, 0)::int` })
    .from(listEntries)
    .where(and(eq(listEntries.listId, listId), groupFilter));
  const [row] = await d
    .insert(listEntries)
    .values({ listId, itemId, tierId, position: Number(next) })
    .returning();
  return row;
}

export async function deleteEntry(listId: string, entryId: string, d: DB = db) {
  const rows = await d
    .delete(listEntries)
    .where(and(eq(listEntries.listId, listId), eq(listEntries.id, entryId)))
    .returning({ id: listEntries.id });
  return rows.length > 0;
}

/** Rewrites tier + position for every given entry in one transaction. */
export async function applyOrder(
  listId: string,
  order: { id: string; tierId: string | null; position: number }[],
  d: DB = db,
) {
  await d.transaction(async (tx) => {
    for (const e of order) {
      await tx
        .update(listEntries)
        .set({ tierId: e.tierId, position: e.position })
        .where(and(eq(listEntries.listId, listId), eq(listEntries.id, e.id)));
    }
  });
}

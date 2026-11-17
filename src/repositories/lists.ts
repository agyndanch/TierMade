import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, type DB } from "@/db";
import { friendships, items, listEntries, lists, listShares, listTiers, user, type List } from "@/db/schema";

export const DEFAULT_TIERS = [
  { label: "S", color: "#ff7f7f" },
  { label: "A", color: "#ffbf7f" },
  { label: "B", color: "#ffdf7f" },
  { label: "C", color: "#bfff7f" },
  { label: "D", color: "#7fbfff" },
] as const;

export type NewList = {
  ownerId: string;
  title: string;
  description?: string | null;
  category: string;
  format: "ranked" | "tier";
  visibility: "private" | "friends";
};

export async function createList(input: NewList, d: DB = db): Promise<List> {
  return d.transaction(async (tx) => {
    const [list] = await tx
      .insert(lists)
      .values({ ...input, description: input.description ?? null })
      .returning();
    if (input.format === "tier") {
      await tx
        .insert(listTiers)
        .values(DEFAULT_TIERS.map((t, i) => ({ listId: list.id, label: t.label, color: t.color, position: i })));
    }
    return list;
  });
}

export async function findListById(id: string, d: DB = db): Promise<List | null> {
  const rows = await d.select().from(lists).where(eq(lists.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateList(
  id: string,
  patch: Partial<
    Pick<
      List,
      | "title"
      | "description"
      | "visibility"
      | "view"
      | "gridColumns"
      | "gridRows"
      | "showNumbers"
      | "showTitles"
      | "showCreators"
    >
  >,
  d: DB = db,
): Promise<List | null> {
  const [row] = await d
    .update(lists)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(lists.id, id))
    .returning();
  return row ?? null;
}

export async function touchList(id: string, d: DB = db) {
  await d.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, id));
}

export async function deleteList(id: string, d: DB = db) {
  await d.delete(lists).where(eq(lists.id, id));
}

export type ListSummary = List & {
  ownerUsername: string;
  ownerName: string;
  entryCount: number;
  covers: string[];
};

const summaryCols = {
  list: lists,
  ownerUsername: user.username,
  ownerName: user.name,
  entryCount: sql<number>`(select count(*)::int from ${listEntries} where ${listEntries.listId} = ${lists.id})`,
};

async function attachCovers(
  rows: { list: List; ownerUsername: string | null; ownerName: string; entryCount: number }[],
  d: DB,
): Promise<ListSummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.list.id);
  // First few cover images per list, in ranked/tier order.
  const coverRows = await d
    .select({ listId: listEntries.listId, imageUrl: items.imageUrl })
    .from(listEntries)
    .innerJoin(items, eq(items.id, listEntries.itemId))
    .leftJoin(listTiers, eq(listTiers.id, listEntries.tierId))
    .where(inArray(listEntries.listId, ids))
    .orderBy(asc(listEntries.unranked), asc(sql`coalesce(${listTiers.position}, 999)`), asc(listEntries.position));
  const covers = new Map<string, string[]>();
  for (const c of coverRows) {
    if (!c.imageUrl) continue;
    const arr = covers.get(c.listId) ?? [];
    if (arr.length < 4) arr.push(c.imageUrl);
    covers.set(c.listId, arr);
  }
  return rows.map((r) => ({
    ...r.list,
    ownerUsername: r.ownerUsername ?? "",
    ownerName: r.ownerName,
    entryCount: Number(r.entryCount),
    covers: covers.get(r.list.id) ?? [],
  }));
}

export async function listsByOwner(ownerId: string, d: DB = db): Promise<ListSummary[]> {
  const rows = await d
    .select(summaryCols)
    .from(lists)
    .innerJoin(user, eq(user.id, lists.ownerId))
    .where(eq(lists.ownerId, ownerId))
    .orderBy(desc(lists.updatedAt));
  return attachCovers(rows, d);
}

export async function listsByOwnerAndCategory(ownerId: string, category: string, d: DB = db) {
  return d
    .select()
    .from(lists)
    .where(and(eq(lists.ownerId, ownerId), eq(lists.category, category)))
    .orderBy(desc(lists.updatedAt));
}

/**
 * SQL condition: someone else's list that `viewerId` may see, because it was
 * shared with them directly or it's visibility = 'friends' and the owner is an
 * accepted friend. Mirrors canViewList in services/access.ts.
 */
function visibleToOthers(viewerId: string, d: DB) {
  const directlyShared = d
    .select({ id: listShares.listId })
    .from(listShares)
    .where(eq(listShares.userId, viewerId));

  const friendIds = d
    .select({
      id: sql<string>`case when ${friendships.requesterId} = ${viewerId} then ${friendships.addresseeId} else ${friendships.requesterId} end`,
    })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, viewerId), eq(friendships.addresseeId, viewerId)),
      ),
    );

  return and(
    sql`${lists.ownerId} <> ${viewerId}`,
    or(inArray(lists.id, directlyShared), and(eq(lists.visibility, "friends"), inArray(lists.ownerId, friendIds))),
  );
}

/** Lists other people have made visible to `userId`, most recently updated first. */
export async function listsVisibleToUser(userId: string, d: DB = db): Promise<ListSummary[]> {
  const rows = await d
    .select(summaryCols)
    .from(lists)
    .innerJoin(user, eq(user.id, lists.ownerId))
    .where(visibleToOthers(userId, d))
    .orderBy(desc(lists.updatedAt));
  return attachCovers(rows, d);
}

export type ListFilters = {
  /** one person's lists (yours: all of them; anyone else's: only those you may see) */
  ownerId?: string;
  category?: string;
  format?: "ranked" | "tier";
  /** title contains, case-insensitive */
  q?: string;
  sort?: "recent" | "title";
  limit?: number;
  offset?: number;
};

function filterConditions(viewerId: string, f: ListFilters, d: DB) {
  const conds = [];
  if (f.ownerId && f.ownerId === viewerId) {
    conds.push(eq(lists.ownerId, viewerId));
  } else {
    conds.push(visibleToOthers(viewerId, d));
    if (f.ownerId) conds.push(eq(lists.ownerId, f.ownerId));
  }
  if (f.category) conds.push(eq(lists.category, f.category));
  if (f.format) conds.push(eq(lists.format, f.format));
  if (f.q) conds.push(ilike(lists.title, `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`));
  return and(...conds);
}

/** Filtered, paged lists the viewer may see (see ListFilters). */
export async function searchLists(
  viewerId: string,
  f: ListFilters = {},
  d: DB = db,
): Promise<{ lists: ListSummary[]; hasMore: boolean }> {
  const limit = f.limit ?? 24;
  const rows = await d
    .select(summaryCols)
    .from(lists)
    .innerJoin(user, eq(user.id, lists.ownerId))
    .where(filterConditions(viewerId, f, d))
    .orderBy(
      ...(f.sort === "title" ? [asc(sql`lower(${lists.title})`)] : [desc(lists.updatedAt)]),
      asc(lists.id),
    )
    .limit(limit + 1)
    .offset(f.offset ?? 0);
  return { lists: await attachCovers(rows.slice(0, limit), d), hasMore: rows.length > limit };
}

/** How many lists by `ownerId` the viewer may see (all of them for your own). */
export async function countVisibleLists(viewerId: string, ownerId: string, d: DB = db): Promise<number> {
  const [row] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(lists)
    .where(filterConditions(viewerId, { ownerId }, d));
  return Number(row?.n ?? 0);
}

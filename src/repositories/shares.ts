import { and, eq, inArray } from "drizzle-orm";
import { db, type DB } from "@/db";
import { lists, listShares } from "@/db/schema";

export async function hasShare(listId: string, userId: string, d: DB = db) {
  const rows = await d
    .select({ listId: listShares.listId })
    .from(listShares)
    .where(and(eq(listShares.listId, listId), eq(listShares.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function addShare(listId: string, userId: string, d: DB = db) {
  await d.insert(listShares).values({ listId, userId }).onConflictDoNothing();
}

export async function removeShare(listId: string, userId: string, d: DB = db) {
  await d.delete(listShares).where(and(eq(listShares.listId, listId), eq(listShares.userId, userId)));
}

export async function sharedUserIds(listId: string, d: DB = db): Promise<string[]> {
  const rows = await d.select({ userId: listShares.userId }).from(listShares).where(eq(listShares.listId, listId));
  return rows.map((r) => r.userId);
}

/** Removes every share between two users' lists (used when unfriending). */
export async function removeSharesBetween(a: string, b: string, d: DB = db) {
  const aLists = d.select({ id: lists.id }).from(lists).where(eq(lists.ownerId, a));
  const bLists = d.select({ id: lists.id }).from(lists).where(eq(lists.ownerId, b));
  await d.delete(listShares).where(and(inArray(listShares.listId, aLists), eq(listShares.userId, b)));
  await d.delete(listShares).where(and(inArray(listShares.listId, bLists), eq(listShares.userId, a)));
}

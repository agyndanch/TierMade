import { and, eq, or } from "drizzle-orm";
import { db, type DB } from "@/db";
import { friendships, type Friendship } from "@/db/schema";

const pair = (a: string, b: string) =>
  or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  );

export async function findFriendshipBetween(a: string, b: string, d: DB = db): Promise<Friendship | null> {
  const rows = await d.select().from(friendships).where(pair(a, b)).limit(1);
  return rows[0] ?? null;
}

export async function findFriendshipById(id: string, d: DB = db): Promise<Friendship | null> {
  const rows = await d.select().from(friendships).where(eq(friendships.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createFriendRequest(requesterId: string, addresseeId: string, d: DB = db) {
  const [row] = await d.insert(friendships).values({ requesterId, addresseeId }).returning();
  return row;
}

export async function updateFriendship(
  id: string,
  patch: Partial<Pick<Friendship, "status" | "requesterId" | "addresseeId">>,
  d: DB = db,
) {
  const [row] = await d
    .update(friendships)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(friendships.id, id))
    .returning();
  return row ?? null;
}

export async function deleteFriendship(id: string, d: DB = db) {
  await d.delete(friendships).where(eq(friendships.id, id));
}

export async function friendshipsForUser(userId: string, d: DB = db): Promise<Friendship[]> {
  return d
    .select()
    .from(friendships)
    .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
}

export async function areFriends(a: string, b: string, d: DB = db): Promise<boolean> {
  const f = await findFriendshipBetween(a, b, d);
  return f?.status === "accepted";
}

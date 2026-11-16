import type { List } from "@/db/schema";
import { db, type DB } from "@/db";
import { areFriends } from "@/repositories/friendships";
import { hasShare } from "@/repositories/shares";
import { findListById } from "@/repositories/lists";
import { forbidden, notFound } from "@/lib/errors";

/**
 * The single source of truth for who can see a list:
 *  - the owner, always
 *  - a user it was shared with directly
 *  - any accepted friend, when visibility = 'friends'
 * Only the owner can edit.
 */
export async function canViewList(list: List, viewerId: string | null, d: DB = db): Promise<boolean> {
  if (!viewerId) return false;
  if (list.ownerId === viewerId) return true;
  if (await hasShare(list.id, viewerId, d)) return true;
  if (list.visibility === "friends" && (await areFriends(list.ownerId, viewerId, d))) return true;
  return false;
}

/** Loads a list the viewer may see. Unknown and forbidden both read as 404 to avoid leaking ids. */
export async function getViewableList(listId: string, viewerId: string, d: DB = db): Promise<List> {
  const list = await findListById(listId, d);
  if (!list || !(await canViewList(list, viewerId, d))) throw notFound("List not found");
  return list;
}

export async function getOwnedList(listId: string, userId: string, d: DB = db): Promise<List> {
  const list = await findListById(listId, d);
  if (!list) throw notFound("List not found");
  if (list.ownerId !== userId) {
    if (await canViewList(list, userId, d)) throw forbidden("Only the owner can edit this list");
    throw notFound("List not found");
  }
  return list;
}

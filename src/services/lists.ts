import { db, type DB } from "@/db";
import type { List, ListTier } from "@/db/schema";
import { CATEGORIES, isCategoryId } from "@/catalog/categories";
import type { CatalogAdapter } from "@/catalog/types";
import { badRequest, conflict, notFound } from "@/lib/errors";
import * as listsRepo from "@/repositories/lists";
import * as entriesRepo from "@/repositories/entries";
import { upsertItem } from "@/repositories/items";
import { findUserById, findUsersByIds, type PublicUser } from "@/repositories/users";
import { addShare, removeShare, sharedUserIds } from "@/repositories/shares";
import { areFriends } from "@/repositories/friendships";
import { getOwnedList, getViewableList } from "./access";

export type ListDetail = {
  list: List;
  owner: PublicUser;
  tiers: ListTier[];
  entries: entriesRepo.EntryWithItem[];
  isOwner: boolean;
};

export async function createList(ownerId: string, input: Omit<listsRepo.NewList, "ownerId">, d: DB = db) {
  return listsRepo.createList({ ...input, ownerId }, d);
}

export async function getListDetail(listId: string, viewerId: string, d: DB = db): Promise<ListDetail> {
  const list = await getViewableList(listId, viewerId, d);
  const [owner, tiers, entries] = await Promise.all([
    findUserById(list.ownerId, d),
    entriesRepo.tiersForList(list.id, d),
    entriesRepo.entriesForList(list.id, d),
  ]);
  if (!owner) throw notFound("List not found");
  return { list, owner, tiers, entries, isOwner: list.ownerId === viewerId };
}

export async function updateList(
  listId: string,
  userId: string,
  patch: { title?: string; description?: string | null; visibility?: "private" | "friends" },
  d: DB = db,
) {
  await getOwnedList(listId, userId, d);
  return listsRepo.updateList(listId, patch, d);
}

export async function deleteList(listId: string, userId: string, d: DB = db) {
  await getOwnedList(listId, userId, d);
  await listsRepo.deleteList(listId, d);
}

/**
 * Search-to-add: the server resolves the external id through the category's
 * adapter (never trusting client-sent titles/images), caches the item, and
 * appends it to the list.
 */
export async function addItemToList(
  listId: string,
  userId: string,
  externalId: string,
  tierId: string | null,
  adapterFor: (category: List["category"]) => CatalogAdapter,
  d: DB = db,
) {
  const list = await getOwnedList(listId, userId, d);
  if (!isCategoryId(list.category)) throw badRequest("This list's category is no longer supported");

  if (tierId) {
    if (list.format !== "tier") throw badRequest("Ranked lists don't have tiers");
    const tiers = await entriesRepo.tiersForList(list.id, d);
    if (!tiers.some((t) => t.id === tierId)) throw badRequest("Unknown tier");
  }

  const adapter = adapterFor(list.category);
  const result = await adapter.getItem(externalId);
  if (!result) throw notFound(`That ${CATEGORIES[list.category].noun} couldn't be found`);

  const item = await upsertItem(list.category, adapter.source, result, d);
  if (await entriesRepo.entryExistsForItem(list.id, item.id, d)) {
    throw conflict(`"${item.title}" is already on this list`);
  }
  try {
    const entry = await entriesRepo.appendEntry(list.id, item.id, tierId ?? null, d);
    await listsRepo.touchList(list.id, d);
    return {
      id: entry.id,
      tierId: entry.tierId,
      position: entry.position,
      item: {
        id: item.id,
        externalId: item.externalId,
        title: item.title,
        subtitle: item.subtitle,
        year: item.year,
        imageUrl: item.imageUrl,
      },
    } satisfies entriesRepo.EntryWithItem;
  } catch (e) {
    // unique(list_id, item_id) — lost a race with a concurrent add
    const err = e as { code?: string; cause?: { code?: string } };
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      throw conflict(`"${item.title}" is already on this list`);
    }
    throw e;
  }
}

export async function removeEntry(listId: string, userId: string, entryId: string, d: DB = db) {
  await getOwnedList(listId, userId, d);
  const ok = await entriesRepo.deleteEntry(listId, entryId, d);
  if (!ok) throw notFound("Entry not found");
  await listsRepo.touchList(listId, d);
}

export async function reorderList(
  listId: string,
  userId: string,
  order: { id: string; tierId: string | null; position: number }[],
  d: DB = db,
) {
  const list = await getOwnedList(listId, userId, d);
  const [entries, tiers] = await Promise.all([
    entriesRepo.entriesForList(list.id, d),
    entriesRepo.tiersForList(list.id, d),
  ]);
  const entryIds = new Set(entries.map((e) => e.id));
  const tierIds = new Set(tiers.map((t) => t.id));
  const seen = new Set<string>();
  for (const e of order) {
    if (!entryIds.has(e.id)) throw badRequest("Order contains an entry that isn't on this list");
    if (seen.has(e.id)) throw badRequest("Order contains a duplicate entry");
    seen.add(e.id);
    if (e.tierId !== null && (list.format !== "tier" || !tierIds.has(e.tierId))) throw badRequest("Unknown tier");
  }
  if (seen.size !== entryIds.size) throw badRequest("Order must include every entry on the list");
  await entriesRepo.applyOrder(list.id, order, d);
  await listsRepo.touchList(list.id, d);
}

/* ---------------------------- sharing ----------------------------------- */

export async function getShares(listId: string, userId: string, d: DB = db) {
  await getOwnedList(listId, userId, d);
  return findUsersByIds(await sharedUserIds(listId, d), d);
}

export async function shareList(listId: string, ownerId: string, friendId: string, d: DB = db) {
  await getOwnedList(listId, ownerId, d);
  if (friendId === ownerId) throw badRequest("You already own this list");
  if (!(await areFriends(ownerId, friendId, d))) throw badRequest("You can only share lists with friends");
  await addShare(listId, friendId, d);
}

export async function unshareList(listId: string, ownerId: string, friendId: string, d: DB = db) {
  await getOwnedList(listId, ownerId, d);
  await removeShare(listId, friendId, d);
}

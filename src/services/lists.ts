import { db, type DB } from "@/db";
import type { Item, List, ListTier } from "@/db/schema";
import { CATEGORIES, isCategoryId } from "@/catalog/categories";
import type { CatalogAdapter } from "@/catalog/types";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_USER, imagePath, sniffImageType } from "@/lib/images";
import * as listsRepo from "@/repositories/lists";
import * as entriesRepo from "@/repositories/entries";
import { countImagesByOwner, insertImage } from "@/repositories/images";
import { deleteOrphanedCustomItems, insertCustomItem, upsertItem } from "@/repositories/items";
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
  patch: Parameters<typeof listsRepo.updateList>[1],
  d: DB = db,
) {
  await getOwnedList(listId, userId, d);
  return listsRepo.updateList(listId, patch, d);
}

export async function deleteList(listId: string, userId: string, d: DB = db) {
  await getOwnedList(listId, userId, d);
  const itemIds = (await entriesRepo.entriesForList(listId, d)).map((e) => e.item.id);
  await listsRepo.deleteList(listId, d);
  await deleteOrphanedCustomItems(itemIds, d);
}

async function assertTierOnList(list: List, tierId: string | null | undefined, d: DB) {
  if (!tierId) return;
  if (list.format !== "tier") throw badRequest("Ranked lists don't have tiers");
  const tiers = await entriesRepo.tiersForList(list.id, d);
  if (!tiers.some((t) => t.id === tierId)) throw badRequest("Unknown tier");
}

/** Highest slot a ranked-list item can occupy (0-based), i.e. #1000. */
export const MAX_SLOT = 999;

/**
 * Where a newly added item goes. Tier lists: end of the given tier (or the
 * unsorted pool). Ranked lists: the slot after the last ranked item, unless
 * the list is shown as a grid and that slot is past the grid, in which case
 * it waits in "Not ranked yet".
 */
async function placementForNewEntry(list: List, tierId: string | null, d: DB): Promise<entriesRepo.Placement> {
  if (list.format === "tier") {
    return { tierId, unranked: false, position: await entriesRepo.nextPosition(list.id, { tierId, unranked: false }, d) };
  }
  const slot = await entriesRepo.nextPosition(list.id, { tierId: null, unranked: false }, d);
  const pastGrid = list.view === "grid" && slot >= list.gridColumns * list.gridRows;
  if (pastGrid || slot > MAX_SLOT) {
    return { tierId: null, unranked: true, position: await entriesRepo.nextPosition(list.id, { tierId: null, unranked: true }, d) };
  }
  return { tierId: null, unranked: false, position: slot };
}

function toEntryWithItem(
  entry: { id: string; tierId: string | null; position: number; unranked: boolean },
  item: Item,
): entriesRepo.EntryWithItem {
  return {
    id: entry.id,
    tierId: entry.tierId,
    position: entry.position,
    unranked: entry.unranked,
    customTitle: null,
    customSubtitle: null,
    item: {
      id: item.id,
      externalId: item.externalId,
      title: item.title,
      subtitle: item.subtitle,
      originalTitle: item.title,
      originalSubtitle: item.subtitle,
      year: item.year,
      imageUrl: item.imageUrl,
    },
  };
}

/**
 * The owner's own names for an item in this list ("P5R" for "Persona 5 Royal").
 * Only this list changes; the catalog item and everyone else's lists don't.
 * Pass null to go back to the catalog's name.
 */
export async function renameEntry(
  listId: string,
  userId: string,
  entryId: string,
  labels: { displayTitle: string | null; displaySubtitle: string | null },
  d: DB = db,
): Promise<entriesRepo.EntryWithItem> {
  await getOwnedList(listId, userId, d);
  if (!(await entriesRepo.updateEntryLabels(listId, entryId, labels, d))) throw notFound("Entry not found");
  await listsRepo.touchList(listId, d);
  const entry = (await entriesRepo.entriesForList(listId, d)).find((e) => e.id === entryId);
  if (!entry) throw notFound("Entry not found");
  return entry;
}

export type CustomItemInput = {
  title: string;
  creator: string | null;
  tierId?: string | null;
  /** an https link to hotlink, or… */
  imageUrl?: string;
  /** …an uploaded image (already resized by the browser) */
  image?: Buffer;
};

/**
 * Custom add: for things the catalog search can't find. The item is a normal
 * `items` row (source "custom") so every view and the comparison handle it.
 */
export async function addCustomItemToList(listId: string, userId: string, input: CustomItemInput, d: DB = db) {
  const list = await getOwnedList(listId, userId, d);
  await assertTierOnList(list, input.tierId, d);
  if (input.image && input.imageUrl) throw badRequest("Use an uploaded image or an image link, not both");

  const image = input.image;
  let contentType: string | null = null;
  if (image) {
    if (image.byteLength > MAX_IMAGE_BYTES) throw badRequest("That image is too large (1 MB max)");
    contentType = sniffImageType(image);
    if (!contentType) throw badRequest("Use a JPEG, PNG, WebP or GIF image");
    if ((await countImagesByOwner(userId, d)) >= MAX_IMAGES_PER_USER) {
      throw badRequest(`You've reached the limit of ${MAX_IMAGES_PER_USER} uploaded images`);
    }
  }

  const { entry, item } = await d.transaction(async (tx) => {
    const imageUrl =
      image && contentType
        ? imagePath((await insertImage({ ownerId: userId, contentType, data: image }, tx)).id)
        : (input.imageUrl ?? null);
    const item = await insertCustomItem(
      { category: list.category, title: input.title, subtitle: input.creator, imageUrl, createdBy: userId },
      tx,
    );
    const at = await placementForNewEntry(list, input.tierId ?? null, tx);
    const entry = await entriesRepo.insertEntry(list.id, item.id, at, tx);
    return { entry, item };
  });
  await listsRepo.touchList(list.id, d);
  return toEntryWithItem(entry, item);
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

  await assertTierOnList(list, tierId, d);

  const adapter = adapterFor(list.category);
  const result = await adapter.getItem(externalId);
  if (!result) throw notFound(`That ${CATEGORIES[list.category].noun} couldn't be found`);

  const item = await upsertItem(list.category, adapter.source, result, d);
  if (await entriesRepo.entryExistsForItem(list.id, item.id, d)) {
    throw conflict(`"${item.title}" is already on this list`);
  }
  try {
    const at = await placementForNewEntry(list, tierId ?? null, d);
    const entry = await entriesRepo.insertEntry(list.id, item.id, at, d);
    await listsRepo.touchList(list.id, d);
    return toEntryWithItem(entry, item);
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
  const entry = await entriesRepo.findEntry(listId, entryId, d);
  const ok = await entriesRepo.deleteEntry(listId, entryId, d);
  if (!ok) throw notFound("Entry not found");
  if (entry) await deleteOrphanedCustomItems([entry.itemId], d);
  await listsRepo.touchList(listId, d);
}

export async function reorderList(
  listId: string,
  userId: string,
  order: { id: string; tierId: string | null; position: number; unranked?: boolean }[],
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
  const slotsTaken = new Set<number>();
  for (const e of order) {
    if (!entryIds.has(e.id)) throw badRequest("Order contains an entry that isn't on this list");
    if (seen.has(e.id)) throw badRequest("Order contains a duplicate entry");
    seen.add(e.id);
    if (e.tierId !== null && (list.format !== "tier" || !tierIds.has(e.tierId))) throw badRequest("Unknown tier");
    if (e.unranked && list.format !== "ranked") throw badRequest("Only ranked lists have a Not ranked yet area");
    if (list.format === "ranked" && !e.unranked) {
      // Ranked slots can have gaps but never hold two items.
      if (e.position > MAX_SLOT) throw badRequest(`Ranks go up to #${MAX_SLOT + 1}`);
      if (slotsTaken.has(e.position)) throw badRequest("Two items can't share a rank");
      slotsTaken.add(e.position);
    }
  }
  if (seen.size !== entryIds.size) throw badRequest("Order must include every entry on the list");
  await entriesRepo.applyOrder(
    list.id,
    order.map((e) => ({ id: e.id, tierId: e.tierId, position: e.position, unranked: Boolean(e.unranked) })),
    d,
  );
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

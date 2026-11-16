import { db, type DB } from "@/db";
import { badRequest, notFound } from "@/lib/errors";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_USER, imageIdFromUrl, imagePath, sniffImageType } from "@/lib/images";
import { findFriendshipBetween, friendshipsForUser } from "@/repositories/friendships";
import { countImagesByOwner, deleteImage, insertImage } from "@/repositories/images";
import { countVisibleLists } from "@/repositories/lists";
import { findProfileByUsername, findUserById, findUsersByIds, updateProfile, type ProfileUser, type PublicUser } from "@/repositories/users";

export type Relationship = "self" | "friends" | "request-received" | "request-sent" | "none";

export type Profile = {
  user: ProfileUser;
  relationship: Relationship;
  /** the pending request to accept/decline when relationship = "request-received" */
  requestId: string | null;
  stats: { lists: number; friends: number };
};

async function friendIdsOf(userId: string, d: DB): Promise<string[]> {
  const rows = await friendshipsForUser(userId, d);
  return rows
    .filter((r) => r.status === "accepted")
    .map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

/**
 * Anyone signed in can open a profile. Which lists it shows (and counts) is
 * decided by the normal list visibility rules for the viewer.
 */
export async function getProfile(username: string, viewerId: string, d: DB = db): Promise<Profile> {
  const user = await findProfileByUsername(username, d);
  if (!user) throw notFound("No such user");

  let relationship: Relationship = "self";
  let requestId: string | null = null;
  if (user.id !== viewerId) {
    const f = await findFriendshipBetween(user.id, viewerId, d);
    if (f?.status === "accepted") relationship = "friends";
    else if (f?.status === "pending" && f.addresseeId === viewerId) {
      relationship = "request-received";
      requestId = f.id;
    } else if (f?.status === "pending") relationship = "request-sent";
    else relationship = "none";
  }

  const [lists, friendIds] = await Promise.all([countVisibleLists(viewerId, user.id, d), friendIdsOf(user.id, d)]);
  return { user, relationship, requestId, stats: { lists, friends: friendIds.length } };
}

/**
 * A profile's friends, mutual friends first. Only the person themselves and
 * their friends may see it; everyone else gets null (and just sees the count).
 */
export async function getProfileFriends(
  profileUserId: string,
  viewerId: string,
  d: DB = db,
): Promise<(PublicUser & { mutual: boolean })[] | null> {
  const theirs = await friendIdsOf(profileUserId, d);
  if (profileUserId !== viewerId && !theirs.includes(viewerId)) return null;
  const mine = new Set(profileUserId === viewerId ? [] : await friendIdsOf(viewerId, d));
  const users = await findUsersByIds(theirs, d);
  return users
    .map((u) => ({ ...u, mutual: mine.has(u.id) }))
    .sort((a, b) => Number(b.mutual) - Number(a.mutual) || a.username.localeCompare(b.username));
}

export type ProfileUpdate = {
  name: string;
  bio: string | null;
  /** a new avatar (already resized by the browser) */
  avatar?: Buffer;
  removeAvatar?: boolean;
};

export async function updateMyProfile(userId: string, input: ProfileUpdate, d: DB = db) {
  const me = await findUserById(userId, d);
  if (!me) throw notFound("No such user");
  if (input.avatar && input.removeAvatar) throw badRequest("Upload a new photo or remove it, not both");

  let image: string | null | undefined;
  if (input.avatar) {
    if (input.avatar.byteLength > MAX_IMAGE_BYTES) throw badRequest("That image is too large (1 MB max)");
    const contentType = sniffImageType(input.avatar);
    if (!contentType) throw badRequest("Use a JPEG, PNG, WebP or GIF image");
    if ((await countImagesByOwner(userId, d)) >= MAX_IMAGES_PER_USER) {
      throw badRequest(`You've reached the limit of ${MAX_IMAGES_PER_USER} uploaded images`);
    }
    image = imagePath((await insertImage({ ownerId: userId, contentType, data: input.avatar }, d)).id);
  } else if (input.removeAvatar) {
    image = null;
  }

  await updateProfile(userId, { name: input.name, bio: input.bio, ...(image !== undefined ? { image } : {}) }, d);

  // The old uploaded photo isn't used anywhere else once replaced or removed.
  const oldImageId = image !== undefined ? imageIdFromUrl(me.image) : null;
  if (oldImageId) await deleteImage(oldImageId, d);
}

import { db, type DB } from "@/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import * as repo from "@/repositories/friendships";
import { removeSharesBetween } from "@/repositories/shares";
import { findUserByUsername, findUsersByIds, type PublicUser } from "@/repositories/users";

export type FriendsOverview = {
  friends: (PublicUser & { friendshipId: string })[];
  incoming: (PublicUser & { requestId: string })[];
  outgoing: (PublicUser & { requestId: string })[];
};

export async function getFriendsOverview(userId: string, d: DB = db): Promise<FriendsOverview> {
  const rows = await repo.friendshipsForUser(userId, d);
  const otherId = (r: (typeof rows)[number]) => (r.requesterId === userId ? r.addresseeId : r.requesterId);
  const users = new Map((await findUsersByIds(rows.map(otherId), d)).map((u) => [u.id, u]));
  const out: FriendsOverview = { friends: [], incoming: [], outgoing: [] };
  for (const r of rows) {
    const u = users.get(otherId(r));
    if (!u) continue;
    if (r.status === "accepted") out.friends.push({ ...u, friendshipId: r.id });
    else if (r.status === "pending" && r.addresseeId === userId) out.incoming.push({ ...u, requestId: r.id });
    else if (r.status === "pending") out.outgoing.push({ ...u, requestId: r.id });
  }
  out.friends.sort((a, b) => a.username.localeCompare(b.username));
  return out;
}

export async function sendFriendRequest(fromId: string, username: string, d: DB = db) {
  const target = await findUserByUsername(username, d);
  if (!target) throw notFound(`No user named "${username}"`);
  if (target.id === fromId) throw badRequest("You can't friend yourself");

  const existing = await repo.findFriendshipBetween(fromId, target.id, d);
  if (!existing) {
    await repo.createFriendRequest(fromId, target.id, d);
    return { status: "pending" as const, user: target };
  }
  if (existing.status === "accepted") throw conflict(`You're already friends with ${target.username}`);
  if (existing.status === "pending" && existing.requesterId === fromId) {
    throw conflict(`You already sent ${target.username} a request`);
  }
  if (existing.status === "pending") {
    // They already asked us — sending one back means yes.
    await repo.updateFriendship(existing.id, { status: "accepted" }, d);
    return { status: "accepted" as const, user: target };
  }
  // Previously declined: start a fresh request from the current sender.
  await repo.updateFriendship(existing.id, { status: "pending", requesterId: fromId, addresseeId: target.id }, d);
  return { status: "pending" as const, user: target };
}

export async function respondToRequest(requestId: string, userId: string, accept: boolean, d: DB = db) {
  const req = await repo.findFriendshipById(requestId, d);
  if (!req || (req.addresseeId !== userId && req.requesterId !== userId)) throw notFound("Request not found");
  if (req.addresseeId !== userId) throw forbidden("Only the recipient can respond to a request");
  if (req.status !== "pending") throw conflict("This request was already answered");
  await repo.updateFriendship(req.id, { status: accept ? "accepted" : "declined" }, d);
}

/** Unfriend or cancel an outgoing request. Also revokes direct shares between the two. */
export async function removeFriend(userId: string, otherUserId: string, d: DB = db) {
  const f = await repo.findFriendshipBetween(userId, otherUserId, d);
  if (!f) throw notFound("Not friends");
  await repo.deleteFriendship(f.id, d);
  await removeSharesBetween(userId, otherUserId, d);
}

import { and, asc, ilike, inArray, ne } from "drizzle-orm";
import { db, type DB } from "@/db";
import { user } from "@/db/schema";

export type PublicUser = { id: string; name: string; username: string; image: string | null };

const publicCols = {
  id: user.id,
  name: user.name,
  username: user.username,
  image: user.image,
};

function toPublic(row: { id: string; name: string; username: string | null; image: string | null }): PublicUser {
  return { ...row, username: row.username ?? "" };
}

export async function findUserById(id: string, d: DB = db): Promise<PublicUser | null> {
  const rows = await d.select(publicCols).from(user).where(inArray(user.id, [id])).limit(1);
  return rows[0] ? toPublic(rows[0]) : null;
}

export async function findUsersByIds(ids: string[], d: DB = db): Promise<PublicUser[]> {
  if (ids.length === 0) return [];
  const rows = await d.select(publicCols).from(user).where(inArray(user.id, ids));
  return rows.map(toPublic);
}

export async function findUserByUsername(username: string, d: DB = db): Promise<PublicUser | null> {
  // usernames are stored lowercased by the Better Auth username plugin
  const rows = await d
    .select(publicCols)
    .from(user)
    .where(inArray(user.username, [username.toLowerCase()]))
    .limit(1);
  return rows[0] ? toPublic(rows[0]) : null;
}

export async function searchUsersByUsername(
  prefix: string,
  excludeUserId: string,
  limit = 10,
  d: DB = db,
): Promise<PublicUser[]> {
  const escaped = prefix.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await d
    .select(publicCols)
    .from(user)
    .where(and(ilike(user.username, `${escaped}%`), ne(user.id, excludeUserId)))
    .orderBy(asc(user.username))
    .limit(limit);
  return rows.map(toPublic);
}

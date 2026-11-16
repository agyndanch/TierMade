import { count, eq } from "drizzle-orm";
import { db, type DB } from "@/db";
import { images } from "@/db/schema";

export async function insertImage(
  input: { ownerId: string; contentType: string; data: Buffer },
  d: DB = db,
): Promise<{ id: string }> {
  const [row] = await d
    .insert(images)
    .values({ ...input, byteSize: input.data.byteLength })
    .returning({ id: images.id });
  return row;
}

export async function findImage(id: string, d: DB = db) {
  const rows = await d
    .select({ contentType: images.contentType, data: images.data })
    .from(images)
    .where(eq(images.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function countImagesByOwner(ownerId: string, d: DB = db): Promise<number> {
  const [row] = await d.select({ n: count() }).from(images).where(eq(images.ownerId, ownerId));
  return Number(row?.n ?? 0);
}

export async function deleteImage(id: string, d: DB = db) {
  await d.delete(images).where(eq(images.id, id));
}

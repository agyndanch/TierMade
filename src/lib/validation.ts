import { z } from "zod";
import { CATEGORY_IDS } from "@/catalog/categories";

export const categorySchema = z.enum(CATEGORY_IDS, { message: "Unknown category" });

export const createListSchema = z.object({
  title: z.string().trim().min(1, "Give your list a title").max(100),
  description: z.string().trim().max(500).optional(),
  category: categorySchema,
  format: z.enum(["ranked", "tier"]),
  visibility: z.enum(["private", "friends"]).default("private"),
});

export const updateListSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).nullable(),
    visibility: z.enum(["private", "friends"]),
  })
  .partial();

export const addEntrySchema = z.object({
  externalId: z.string().trim().min(1).max(64),
  tierId: z.uuid().nullable().optional(),
});

export const reorderSchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.uuid(),
        tierId: z.uuid().nullable(),
        position: z.number().int().min(0),
      }),
    )
    .max(1000),
});

export const friendRequestSchema = z.object({
  username: z.string().trim().min(1).max(32),
});

export const shareSchema = z.object({ userId: z.string().min(1) });

export const searchQuerySchema = z.object({
  category: categorySchema,
  q: z.string().trim().min(1, "Type something to search").max(100),
});

export const compareQuerySchema = z.object({ a: z.uuid(), b: z.uuid() });

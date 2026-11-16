import { z } from "zod";
import { CATEGORY_IDS } from "@/catalog/categories";
import { GRID_MAX, GRID_MIN, LIST_VIEWS } from "@/lib/list-display";

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
    view: z.enum(LIST_VIEWS),
    gridColumns: z.number().int().min(GRID_MIN).max(GRID_MAX),
    gridRows: z.number().int().min(GRID_MIN).max(GRID_MAX),
    showNumbers: z.boolean(),
  })
  .partial();

export const addEntrySchema = z.object({
  externalId: z.string().trim().min(1).max(64),
  tierId: z.uuid().nullable().optional(),
});

/** Form fields arrive as strings; treat "" as "not given". */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const customEntrySchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  creator: z.preprocess(blankToUndefined, z.string().trim().max(200).optional()),
  imageUrl: z.preprocess(
    blankToUndefined,
    z.url({ protocol: /^https$/, message: "Image links must start with https://" }).max(2000).optional(),
  ),
  tierId: z.preprocess(blankToUndefined, z.uuid().optional()),
});

export const BIO_MAX = 160;

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter a display name").max(50, "Display names can be up to 50 characters"),
  bio: z.preprocess(
    blankToUndefined,
    z.string().trim().max(BIO_MAX, `Bios can be up to ${BIO_MAX} characters`).optional(),
  ),
});

/** Query-string filters for the browse page and profile Lists tab. Bad values are ignored. */
export const listFiltersSchema = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()).catch(undefined),
  category: z.preprocess(blankToUndefined, categorySchema.optional()).catch(undefined),
  format: z.preprocess(blankToUndefined, z.enum(["ranked", "tier"]).optional()).catch(undefined),
  sort: z.enum(["recent", "title"]).catch("recent"),
  friend: z.preprocess(blankToUndefined, z.string().max(64).optional()).catch(undefined),
  page: z.coerce.number().int().min(1).max(100).catch(1),
});
export type ListFiltersQuery = z.infer<typeof listFiltersSchema>;

export const reorderSchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.uuid(),
        tierId: z.uuid().nullable(),
        position: z.number().int().min(0).max(999),
        /** ranked lists: in the "Not ranked yet" pool */
        unranked: z.boolean().default(false),
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

import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Better Auth tables (core + username plugin)                         */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  /** profile bio (TierMade, not Better Auth) */
  bio: text("bio"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* TierMade domain                                                     */
/* ------------------------------------------------------------------ */

export const listFormat = pgEnum("list_format", ["ranked", "tier"]);
export const listVisibility = pgEnum("list_visibility", ["private", "friends"]);
export const listView = pgEnum("list_view", ["list", "grid"]);
export const friendshipStatus = pgEnum("friendship_status", [
  "pending",
  "accepted",
  "declined",
]);

/** Postgres bytea. node-postgres returns a Buffer, PGlite a Uint8Array; Buffer works as input for both. */
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

/** Shared catalog cache: every list entry points at one canonical item row. */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: text("category").notNull(),
    /** "deezer" | "igdb" | "tmdb", or "custom" for user-made items */
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    year: integer("year"),
    imageUrl: text("image_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    /** set for custom items: the user who made it */
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("items_source_category_ext_uq").on(t.source, t.category, t.externalId)],
);

export const lists = pgTable(
  "lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    format: listFormat("format").notNull().default("ranked"),
    visibility: listVisibility("visibility").notNull().default("private"),
    /** Ranked lists only: a vertical list, or a cover grid with titles beside each row. */
    view: listView("view").notNull().default("list"),
    gridColumns: integer("grid_columns").notNull().default(5),
    gridRows: integer("grid_rows").notNull().default(5),
    showNumbers: boolean("show_numbers").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("lists_owner_idx").on(t.ownerId)],
);

export const listTiers = pgTable(
  "list_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    color: text("color").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("list_tiers_list_idx").on(t.listId)],
);

export const listEntries = pgTable(
  "list_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    /** null = ranked list, or the "unsorted" pool of a tier list */
    tierId: uuid("tier_id").references(() => listTiers.id, { onDelete: "set null" }),
    /**
     * Ranked lists: the 0-based slot (unique per list, gaps allowed), or, when
     * `unranked`, the order within the "Not ranked yet" pool. Tier lists: order within the tier.
     */
    position: integer("position").notNull(),
    /** ranked lists only: waiting in the "Not ranked yet" pool */
    unranked: boolean("unranked").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("list_entries_list_item_uq").on(t.listId, t.itemId),
    index("list_entries_list_idx").on(t.listId),
  ],
);

export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: friendshipStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // One row per unordered pair of users.
    uniqueIndex("friendships_pair_uq").on(
      sql`least(${t.requesterId}, ${t.addresseeId})`,
      sql`greatest(${t.requesterId}, ${t.addresseeId})`,
    ),
    index("friendships_addressee_idx").on(t.addresseeId),
  ],
);

export const listShares = pgTable(
  "list_shares",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.userId] }), index("list_shares_user_idx").on(t.userId)],
);

/** Cover images uploaded for custom items, served by GET /api/images/[id]. */
export const images = pgTable(
  "images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("images_owner_idx").on(t.ownerId)],
);

export type User = typeof user.$inferSelect;
export type Item = typeof items.$inferSelect;
export type List = typeof lists.$inferSelect;
export type ListTier = typeof listTiers.$inferSelect;
export type ListEntry = typeof listEntries.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;

import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { items, user } from "@/db/schema";
import { runMigrations } from "@/db/migrate";
import type { CatalogAdapter, CatalogResult } from "@/catalog/types";
import { HttpError } from "@/lib/errors";
import { MAX_IMAGE_BYTES, imageIdFromUrl } from "@/lib/images";
import { customEntrySchema, profileSchema, reorderSchema, updateListSchema } from "@/lib/validation";
import { findImage } from "@/repositories/images";
import { listsVisibleToUser, listsByOwner, searchLists } from "@/repositories/lists";
import { findProfileByUsername } from "@/repositories/users";
import * as lists from "@/services/lists";
import * as friends from "@/services/friends";
import * as profiles from "@/services/profiles";
import { compareListsForViewer } from "@/services/compare";

const catalog: Record<string, CatalogResult> = Object.fromEntries(
  ["inception", "heat", "alien", "jaws", "up"].map((id, i) => [
    id,
    { externalId: id, title: id[0].toUpperCase() + id.slice(1), year: 1975 + i * 10, imageUrl: `https://img/${id}.jpg` },
  ]),
);
const fakeAdapter: CatalogAdapter = {
  source: "tmdb",
  search: async (q) => Object.values(catalog).filter((c) => c.title.toLowerCase().includes(q)),
  getItem: async (id) => catalog[id] ?? null,
};
const adapterFor = () => fakeAdapter;

async function makeUser(username: string) {
  const id = `u_${username}`;
  await db.insert(user).values({ id, name: username, email: `${username}@example.test`, username });
  return id;
}

async function expectStatus(p: Promise<unknown>, status: number) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
}

let alice: string, bob: string, carol: string;

beforeAll(async () => {
  await runMigrations(db, "pglite://memory");
  alice = await makeUser("alice");
  bob = await makeUser("bob");
  carol = await makeUser("carol");
});

describe("lists", () => {
  it("creates a ranked list, adds items by external id, and reorders", async () => {
    const list = await lists.createList(alice, { title: "Films", category: "films", format: "ranked", visibility: "private" });
    for (const id of ["inception", "heat", "alien"]) {
      await lists.addItemToList(list.id, alice, id, null, adapterFor);
    }
    let detail = await lists.getListDetail(list.id, alice);
    expect(detail.entries.map((e) => e.item.title)).toEqual(["Inception", "Heat", "Alien"]);
    expect(detail.isOwner).toBe(true);

    const [a, b, c] = detail.entries;
    await lists.reorderList(list.id, alice, [
      { id: c.id, tierId: null, position: 0 },
      { id: a.id, tierId: null, position: 1 },
      { id: b.id, tierId: null, position: 2 },
    ]);
    detail = await lists.getListDetail(list.id, alice);
    expect(detail.entries.map((e) => e.item.title)).toEqual(["Alien", "Inception", "Heat"]);

    const summary = (await listsByOwner(alice)).find((l) => l.id === list.id)!;
    expect(summary.entryCount).toBe(3);
    expect(summary.covers).toEqual(["https://img/alien.jpg", "https://img/inception.jpg", "https://img/heat.jpg"]);
  });

  it("rejects duplicates with 409 and unknown items with 404", async () => {
    const list = await lists.createList(alice, { title: "Dupes", category: "films", format: "ranked", visibility: "private" });
    await lists.addItemToList(list.id, alice, "jaws", null, adapterFor);
    await expectStatus(lists.addItemToList(list.id, alice, "jaws", null, adapterFor), 409);
    await expectStatus(lists.addItemToList(list.id, alice, "nope", null, adapterFor), 404);
  });

  it("reuses one catalog item row across users' lists", async () => {
    const l1 = await lists.createList(alice, { title: "A", category: "films", format: "ranked", visibility: "private" });
    const l2 = await lists.createList(bob, { title: "B", category: "films", format: "ranked", visibility: "private" });
    const e1 = await lists.addItemToList(l1.id, alice, "up", null, adapterFor);
    const e2 = await lists.addItemToList(l2.id, bob, "up", null, adapterFor);
    expect(e1.item.id).toBe(e2.item.id);
  });

  it("seeds S–D tiers for tier lists and validates moves", async () => {
    const list = await lists.createList(alice, { title: "Tiers", category: "films", format: "tier", visibility: "private" });
    let detail = await lists.getListDetail(list.id, alice);
    expect(detail.tiers.map((t) => t.label)).toEqual(["S", "A", "B", "C", "D"]);

    const e = await lists.addItemToList(list.id, alice, "heat", null, adapterFor);
    expect(e.tierId).toBeNull();
    const s = detail.tiers[0];
    await lists.reorderList(list.id, alice, [{ id: e.id, tierId: s.id, position: 0 }]);
    detail = await lists.getListDetail(list.id, alice);
    expect(detail.entries[0].tierId).toBe(s.id);

    // a tier that belongs to another list is rejected
    const other = await lists.createList(alice, { title: "Other", category: "films", format: "tier", visibility: "private" });
    const otherTier = (await lists.getListDetail(other.id, alice)).tiers[0];
    await expectStatus(lists.reorderList(list.id, alice, [{ id: e.id, tierId: otherTier.id, position: 0 }]), 400);
    // order must cover every entry
    await expectStatus(lists.reorderList(list.id, alice, []), 400);
  });

  it("defaults new lists to grid view with every label shown, and saves display settings", async () => {
    const list = await lists.createList(alice, { title: "Grid", category: "films", format: "ranked", visibility: "private" });
    expect(list).toMatchObject({
      view: "grid",
      gridColumns: 5,
      gridRows: 5,
      showNumbers: true,
      showTitles: true,
      showCreators: true,
    });

    const patch = updateListSchema.parse({
      view: "list",
      gridColumns: 3,
      gridRows: 4,
      showNumbers: false,
      showTitles: false,
      showCreators: true,
    });
    await lists.updateList(list.id, alice, patch);
    const { list: saved } = await lists.getListDetail(list.id, alice);
    expect(saved).toMatchObject({
      view: "list",
      gridColumns: 3,
      gridRows: 4,
      showNumbers: false,
      showTitles: false,
      showCreators: true,
      title: "Grid",
    });

    expect(() => updateListSchema.parse({ gridColumns: 11 })).toThrow();
    expect(() => updateListSchema.parse({ gridRows: 0 })).toThrow();
    expect(() => updateListSchema.parse({ view: "carousel" })).toThrow();
    expect(() => updateListSchema.parse({ showTitles: "yes" })).toThrow();
    expect(() => updateListSchema.parse({ showCreators: 1 })).toThrow();
    await expectStatus(lists.updateList(list.id, bob, { view: "list" }), 404);
  });

  it("only lets the owner edit", async () => {
    const list = await lists.createList(alice, { title: "Mine", category: "films", format: "ranked", visibility: "private" });
    await expectStatus(lists.addItemToList(list.id, bob, "heat", null, adapterFor), 404);
    await expectStatus(lists.deleteList(list.id, bob), 404);
  });
});

describe("ranked slots", () => {
  const ranks = async (listId: string) => {
    const { entries } = await lists.getListDetail(listId, alice);
    return entries.map((e) => (e.unranked ? `${e.item.title}:pool` : `${e.item.title}:#${e.position + 1}`));
  };

  it("persists gaps and the Not ranked yet pool", async () => {
    const list = await lists.createList(alice, { title: "Slots", category: "films", format: "ranked", visibility: "private" });
    const [a, b, c] = [
      await lists.addItemToList(list.id, alice, "inception", null, adapterFor),
      await lists.addItemToList(list.id, alice, "heat", null, adapterFor),
      await lists.addItemToList(list.id, alice, "alien", null, adapterFor),
    ];
    expect(await ranks(list.id)).toEqual(["Inception:#1", "Heat:#2", "Alien:#3"]);

    await lists.reorderList(list.id, alice, [
      { id: a.id, tierId: null, position: 0 },
      { id: b.id, tierId: null, position: 9 },
      { id: c.id, tierId: null, position: 0, unranked: true },
    ]);
    expect(await ranks(list.id)).toEqual(["Inception:#1", "Heat:#10", "Alien:pool"]);

    // the next new item goes after the last ranked one, past the gap
    await lists.addItemToList(list.id, alice, "jaws", null, adapterFor);
    expect(await ranks(list.id)).toEqual(["Inception:#1", "Heat:#10", "Jaws:#11", "Alien:pool"]);
  });

  it("rejects shared ranks, ranks past #1000 and pools on tier lists", async () => {
    const list = await lists.createList(alice, { title: "Bad slots", category: "films", format: "ranked", visibility: "private" });
    const a = await lists.addItemToList(list.id, alice, "inception", null, adapterFor);
    const b = await lists.addItemToList(list.id, alice, "heat", null, adapterFor);
    await expectStatus(
      lists.reorderList(list.id, alice, [
        { id: a.id, tierId: null, position: 3 },
        { id: b.id, tierId: null, position: 3 },
      ]),
      400,
    );
    await expectStatus(
      lists.reorderList(list.id, alice, [
        { id: a.id, tierId: null, position: 1000 },
        { id: b.id, tierId: null, position: 0 },
      ]),
      400,
    );
    expect(() =>
      reorderSchema.parse({ entries: [{ id: a.id, tierId: null, position: 1000 }] }),
    ).toThrow();
    // two pool items may share a pool position without clashing with ranks
    await lists.reorderList(list.id, alice, [
      { id: a.id, tierId: null, position: 0 },
      { id: b.id, tierId: null, position: 0, unranked: true },
    ]);

    const tierList = await lists.createList(alice, { title: "T", category: "films", format: "tier", visibility: "private" });
    const t = await lists.addItemToList(tierList.id, alice, "heat", null, adapterFor);
    expect(t.unranked).toBe(false);
    await expectStatus(lists.reorderList(tierList.id, alice, [{ id: t.id, tierId: null, position: 0, unranked: true }]), 400);
  });

  it("sends new items to Not ranked yet once a grid is full, but not in list view", async () => {
    const list = await lists.createList(alice, { title: "Small grid", category: "films", format: "ranked", visibility: "private" });
    await lists.updateList(list.id, alice, { view: "grid", gridColumns: 1, gridRows: 2 });
    await lists.addItemToList(list.id, alice, "inception", null, adapterFor);
    await lists.addItemToList(list.id, alice, "heat", null, adapterFor);
    const third = await lists.addItemToList(list.id, alice, "alien", null, adapterFor);
    expect(third.unranked).toBe(true);
    const custom = await lists.addCustomItemToList(list.id, alice, { title: "Home video", creator: null });
    expect(custom.unranked).toBe(true);
    expect(await ranks(list.id)).toEqual(["Inception:#1", "Heat:#2", "Alien:pool", "Home video:pool"]);

    await lists.updateList(list.id, alice, { view: "list" });
    const fourth = await lists.addItemToList(list.id, alice, "jaws", null, adapterFor);
    expect(fourth).toMatchObject({ unranked: false, position: 2 });
  });
});

describe("custom items", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const itemExists = async (id: string) => (await db.select().from(items).where(eq(items.id, id))).length > 0;

  it("adds custom items with an uploaded image, a link, or no image", async () => {
    const list = await lists.createList(alice, { title: "Rare songs", category: "songs", format: "ranked", visibility: "private" });
    const uploaded = await lists.addCustomItemToList(list.id, alice, { title: "Demo tape", creator: "Local band", image: png });
    const linked = await lists.addCustomItemToList(list.id, alice, {
      title: "B-side",
      creator: null,
      imageUrl: "https://example.test/cover.jpg",
    });
    const bare = await lists.addCustomItemToList(list.id, alice, { title: "Untitled", creator: null });

    const imageId = imageIdFromUrl(uploaded.item.imageUrl)!;
    expect(imageId).toBeTruthy();
    const stored = await findImage(imageId);
    expect(stored?.contentType).toBe("image/png");
    expect(Buffer.from(stored!.data).equals(png)).toBe(true);
    expect(linked.item.imageUrl).toBe("https://example.test/cover.jpg");
    expect(bare.item.imageUrl).toBeNull();

    const detail = await lists.getListDetail(list.id, alice);
    expect(detail.entries.map((e) => [e.item.title, e.item.subtitle])).toEqual([
      ["Demo tape", "Local band"],
      ["B-side", null],
      ["Untitled", null],
    ]);
  });

  it("rejects bad images, both image sources at once, and bad form fields", async () => {
    const list = await lists.createList(alice, { title: "Bad", category: "songs", format: "ranked", visibility: "private" });
    const add = (input: Partial<lists.CustomItemInput>) =>
      lists.addCustomItemToList(list.id, alice, { title: "X", creator: null, ...input });
    await expectStatus(add({ image: Buffer.from("<svg><script>alert(1)</script></svg>") }), 400);
    await expectStatus(add({ image: Buffer.from("just text") }), 400);
    await expectStatus(add({ image: Buffer.concat([png, Buffer.alloc(MAX_IMAGE_BYTES)]) }), 400);
    await expectStatus(add({ image: png, imageUrl: "https://example.test/a.jpg" }), 400);

    expect(() => customEntrySchema.parse({ title: "  " })).toThrow();
    expect(() => customEntrySchema.parse({ title: "Ok", imageUrl: "http://example.test/a.jpg" })).toThrow();
    expect(() => customEntrySchema.parse({ title: "Ok", imageUrl: "javascript:alert(1)" })).toThrow();
    expect(customEntrySchema.parse({ title: " Ok ", creator: "", imageUrl: "", tierId: "" })).toEqual({ title: "Ok" });
  });

  it("only lets the owner add, and puts tier-list items in the requested tier", async () => {
    const list = await lists.createList(alice, { title: "Tiers", category: "songs", format: "tier", visibility: "private" });
    await expectStatus(lists.addCustomItemToList(list.id, bob, { title: "Nope", creator: null }), 404);

    const s = (await lists.getListDetail(list.id, alice)).tiers[0];
    const entry = await lists.addCustomItemToList(list.id, alice, { title: "Top", creator: null, tierId: s.id });
    expect(entry.tierId).toBe(s.id);
  });

  it("deletes orphaned custom items and their images on remove or list delete", async () => {
    const list = await lists.createList(alice, { title: "Temp", category: "songs", format: "ranked", visibility: "private" });
    const a = await lists.addCustomItemToList(list.id, alice, { title: "A", creator: null, image: png });
    const b = await lists.addCustomItemToList(list.id, alice, { title: "B", creator: null, image: png });
    const catalogEntry = await lists.addItemToList(list.id, alice, "heat", null, adapterFor);

    await lists.removeEntry(list.id, alice, a.id);
    expect(await itemExists(a.item.id)).toBe(false);
    expect(await findImage(imageIdFromUrl(a.item.imageUrl)!)).toBeNull();
    expect(await itemExists(b.item.id)).toBe(true);

    await lists.deleteList(list.id, alice);
    expect(await itemExists(b.item.id)).toBe(false);
    expect(await findImage(imageIdFromUrl(b.item.imageUrl)!)).toBeNull();
    // catalog items are a shared cache and stay
    expect(await itemExists(catalogEntry.item.id)).toBe(true);
  });
});

describe("profiles and finding lists", () => {
  // pat ↔ quinn, pat ↔ tom, quinn ↔ tom, quinn ↔ rae are friends; pat → sam is pending; uma is a stranger.
  let pat: string, quinn: string, rae: string, sam: string, tom: string, uma: string;
  const befriend = async (a: string, aName: string, bName: string, bId: string) => {
    await friends.sendFriendRequest(a, bName);
    const { incoming } = await friends.getFriendsOverview(bId);
    await friends.respondToRequest(incoming.find((r) => r.username === aName)!.requestId, bId, true);
  };
  const titles = (ls: { title: string }[]) => ls.map((l) => l.title);

  beforeAll(async () => {
    [pat, quinn, rae, sam, tom, uma] = await Promise.all(["pat", "quinn", "rae", "sam", "tom", "uma"].map(makeUser));
    await befriend(pat, "pat", "quinn", quinn);
    await befriend(pat, "pat", "tom", tom);
    await befriend(quinn, "quinn", "tom", tom);
    await befriend(quinn, "quinn", "rae", rae);
    await friends.sendFriendRequest(pat, "sam");
    await lists.createList(quinn, { title: "Quinn's films", category: "films", format: "ranked", visibility: "friends" });
    await lists.createList(quinn, { title: "Albums tiers", category: "albums", format: "tier", visibility: "friends" });
    await lists.createList(quinn, { title: "Secret 100%", category: "films", format: "ranked", visibility: "private" });
  });

  it("reports how the viewer knows someone, and what they can see", async () => {
    expect(await profiles.getProfile("quinn", pat)).toMatchObject({ relationship: "friends", stats: { lists: 2, friends: 3 } });
    expect(await profiles.getProfile("quinn", quinn)).toMatchObject({ relationship: "self", stats: { lists: 3 } });
    expect(await profiles.getProfile("QUINN", uma)).toMatchObject({ relationship: "none", stats: { lists: 0 } });
    expect(await profiles.getProfile("sam", pat)).toMatchObject({ relationship: "request-sent", requestId: null });
    const received = await profiles.getProfile("pat", sam);
    expect(received.relationship).toBe("request-received");
    expect(received.requestId).toEqual(expect.any(String));
    await expectStatus(profiles.getProfile("nobody", pat), 404);
  });

  it("searches only lists the viewer may see, with filters, sorting and paging", async () => {
    expect(titles((await searchLists(pat, { ownerId: quinn })).lists).sort()).toEqual(["Albums tiers", "Quinn's films"]);
    expect(titles((await searchLists(pat, { ownerId: quinn, category: "films" })).lists)).toEqual(["Quinn's films"]);
    expect(titles((await searchLists(pat, { ownerId: quinn, format: "tier" })).lists)).toEqual(["Albums tiers"]);
    expect(titles((await searchLists(pat, { ownerId: quinn, q: "ALBUM" })).lists)).toEqual(["Albums tiers"]);
    expect(titles((await searchLists(pat, { ownerId: quinn, q: "%" })).lists)).toEqual([]); // wildcards are literal
    expect(titles((await searchLists(pat, { ownerId: quinn, sort: "title" })).lists)).toEqual(["Albums tiers", "Quinn's films"]);
    const page1 = await searchLists(pat, { ownerId: quinn, sort: "title", limit: 1 });
    expect(page1).toMatchObject({ hasMore: true });
    expect(titles(page1.lists)).toEqual(["Albums tiers"]);

    // never the private one, not for strangers, and all of your own
    expect(titles((await searchLists(pat, {})).lists)).not.toContain("Secret 100%");
    expect((await searchLists(uma, { ownerId: quinn })).lists).toEqual([]);
    expect((await searchLists(quinn, { ownerId: quinn })).lists).toHaveLength(3);
  });

  it("shows a profile's friends to them and their friends only, mutual first", async () => {
    expect(await profiles.getProfileFriends(quinn, uma)).toBeNull();
    const seenByPat = await profiles.getProfileFriends(quinn, pat);
    expect(seenByPat!.map((f) => [f.username, f.mutual])).toEqual([
      ["tom", true],
      ["pat", false],
      ["rae", false],
    ]);
    expect((await profiles.getProfileFriends(quinn, quinn))!.map((f) => f.username)).toEqual(["pat", "rae", "tom"]);
  });

  it("updates name, bio and avatar, cleaning up replaced photos", async () => {
    expect(() => profileSchema.parse({ name: "  " })).toThrow();
    expect(() => profileSchema.parse({ name: "Ok", bio: "x".repeat(161) })).toThrow();
    expect(profileSchema.parse({ name: " Pat ", bio: "  " })).toEqual({ name: "Pat" });

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7]);
    await profiles.updateMyProfile(pat, { name: "Pat P", bio: "Loves synth-pop", avatar: png });
    const first = await findProfileByUsername("pat");
    expect(first).toMatchObject({ name: "Pat P", bio: "Loves synth-pop" });
    const firstImage = imageIdFromUrl(first!.image)!;
    expect(await findImage(firstImage)).not.toBeNull();

    await profiles.updateMyProfile(pat, { name: "Pat P", bio: null, avatar: png });
    const second = await findProfileByUsername("pat");
    expect(second!.bio).toBeNull();
    expect(await findImage(firstImage)).toBeNull(); // old photo deleted
    const secondImage = imageIdFromUrl(second!.image)!;

    await profiles.updateMyProfile(pat, { name: "Pat P", bio: null, removeAvatar: true });
    expect((await findProfileByUsername("pat"))!.image).toBeNull();
    expect(await findImage(secondImage)).toBeNull();

    await expectStatus(profiles.updateMyProfile(pat, { name: "Pat", bio: null, avatar: Buffer.from("<svg/>") }), 400);
  });
});

describe("friends, sharing and access", () => {
  it("runs the request → accept flow", async () => {
    await expectStatus(friends.sendFriendRequest(alice, "alice"), 400);
    await expectStatus(friends.sendFriendRequest(alice, "nobody"), 404);

    const sent = await friends.sendFriendRequest(alice, "Bob");
    expect(sent.status).toBe("pending");
    await expectStatus(friends.sendFriendRequest(alice, "bob"), 409);

    const bobView = await friends.getFriendsOverview(bob);
    expect(bobView.incoming.map((u) => u.username)).toEqual(["alice"]);
    await expectStatus(friends.respondToRequest(bobView.incoming[0].requestId, alice, true), 403);
    await friends.respondToRequest(bobView.incoming[0].requestId, bob, true);

    expect((await friends.getFriendsOverview(alice)).friends.map((f) => f.username)).toEqual(["bob"]);
  });

  it("auto-accepts when both users send a request", async () => {
    await friends.sendFriendRequest(carol, "alice");
    const res = await friends.sendFriendRequest(alice, "carol");
    expect(res.status).toBe("accepted");
  });

  it("enforces list visibility rules", async () => {
    const priv = await lists.createList(alice, { title: "Secret", category: "films", format: "ranked", visibility: "private" });
    const pub = await lists.createList(alice, { title: "For friends", category: "films", format: "ranked", visibility: "friends" });

    // private: friend can't see until shared directly
    await expectStatus(lists.getListDetail(priv.id, bob), 404);
    await lists.shareList(priv.id, alice, bob);
    expect((await lists.getListDetail(priv.id, bob)).isOwner).toBe(false);
    // shared friend still can't edit
    await expectStatus(lists.addItemToList(priv.id, bob, "heat", null, adapterFor), 403);

    // friends visibility: every accepted friend sees it
    expect((await lists.getListDetail(pub.id, carol)).list.title).toBe("For friends");

    const bobSees = (await listsVisibleToUser(bob)).map((l) => l.title);
    expect(bobSees).toEqual(expect.arrayContaining(["Secret", "For friends"]));

    // can only share with friends
    const dave = await makeUser("dave");
    await expectStatus(lists.shareList(priv.id, alice, dave), 400);
    await expectStatus(lists.getListDetail(pub.id, dave), 404);

    // pending friendship grants nothing
    await friends.sendFriendRequest(dave, "alice");
    await expectStatus(lists.getListDetail(pub.id, dave), 404);

    // unfriending revokes direct shares
    await friends.removeFriend(alice, bob);
    await expectStatus(lists.getListDetail(priv.id, bob), 404);
    await expectStatus(lists.getListDetail(pub.id, bob), 404);
  });
});

describe("comparison", () => {
  it("compares two viewable lists in the same category", async () => {
    // alice & carol are friends from the earlier test
    const mine = await lists.createList(alice, { title: "Mine", category: "films", format: "ranked", visibility: "friends" });
    const theirs = await lists.createList(carol, { title: "Theirs", category: "films", format: "ranked", visibility: "friends" });
    for (const id of ["inception", "heat", "alien"]) await lists.addItemToList(mine.id, alice, id, null, adapterFor);
    for (const id of ["inception", "heat", "jaws"]) await lists.addItemToList(theirs.id, carol, id, null, adapterFor);

    const view = await compareListsForViewer(mine.id, theirs.id, alice);
    expect(view.result.shared).toHaveLength(2);
    expect(view.result.agreement).toBe(1);
    expect(view.result.overlap).toBeCloseTo(0.5);
    expect(view.result.tasteMatch).toBe(Math.round(100 * (0.3 * 0.5 + 0.7)));

    const albums = await lists.createList(alice, { title: "Albums", category: "albums", format: "ranked", visibility: "friends" });
    await expectStatus(compareListsForViewer(albums.id, theirs.id, alice), 400);

    const hidden = await lists.createList(bob, { title: "Bob's", category: "films", format: "ranked", visibility: "friends" });
    await expectStatus(compareListsForViewer(mine.id, hidden.id, alice), 404);
  });
});

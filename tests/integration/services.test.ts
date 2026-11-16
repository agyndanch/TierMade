import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { user } from "@/db/schema";
import { runMigrations } from "@/db/migrate";
import type { CatalogAdapter, CatalogResult } from "@/catalog/types";
import { HttpError } from "@/lib/errors";
import { updateListSchema } from "@/lib/validation";
import { listsVisibleToUser, listsByOwner } from "@/repositories/lists";
import * as lists from "@/services/lists";
import * as friends from "@/services/friends";
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

  it("defaults to list view and saves grid display settings", async () => {
    const list = await lists.createList(alice, { title: "Grid", category: "films", format: "ranked", visibility: "private" });
    expect(list).toMatchObject({ view: "list", gridColumns: 5, gridRows: 5, showNumbers: true });

    const patch = updateListSchema.parse({ view: "grid", gridColumns: 3, gridRows: 4, showNumbers: false });
    await lists.updateList(list.id, alice, patch);
    const { list: saved } = await lists.getListDetail(list.id, alice);
    expect(saved).toMatchObject({ view: "grid", gridColumns: 3, gridRows: 4, showNumbers: false, title: "Grid" });

    expect(() => updateListSchema.parse({ gridColumns: 11 })).toThrow();
    expect(() => updateListSchema.parse({ gridRows: 0 })).toThrow();
    expect(() => updateListSchema.parse({ view: "carousel" })).toThrow();
    await expectStatus(lists.updateList(list.id, bob, { view: "list" }), 404);
  });

  it("only lets the owner edit", async () => {
    const list = await lists.createList(alice, { title: "Mine", category: "films", format: "ranked", visibility: "private" });
    await expectStatus(lists.addItemToList(list.id, bob, "heat", null, adapterFor), 404);
    await expectStatus(lists.deleteList(list.id, bob), 404);
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

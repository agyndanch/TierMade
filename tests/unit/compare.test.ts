import { describe, expect, it } from "vitest";
import { compareLists, type CompareSide } from "@/lib/compare";

const ranked = (...ids: string[]): CompareSide => ({
  format: "ranked",
  tierCount: 0,
  entries: ids.map((itemId) => ({ itemId, tierIndex: null })),
});

const tiered = (tiers: Record<string, number | null>, tierCount = 5): CompareSide => ({
  format: "tier",
  tierCount,
  entries: Object.entries(tiers)
    .sort(([, x], [, y]) => (x ?? 99) - (y ?? 99))
    .map(([itemId, tierIndex]) => ({ itemId, tierIndex })),
});

describe("compareLists", () => {
  it("scores identical ranked lists as a perfect match", () => {
    const r = compareLists(ranked("a", "b", "c", "d"), ranked("a", "b", "c", "d"));
    expect(r.overlap).toBe(1);
    expect(r.agreement).toBe(1);
    expect(r.tasteMatch).toBe(100);
    expect(r.biggestDisagreement).toBeNull();
    expect(r.shared.map((s) => s.itemId)).toEqual(["a", "b", "c", "d"]);
  });

  it("gives disjoint lists zero overlap and no agreement", () => {
    const r = compareLists(ranked("a", "b"), ranked("c", "d"));
    expect(r.overlap).toBe(0);
    expect(r.agreement).toBeNull();
    expect(r.tasteMatch).toBe(0);
    expect(r.onlyA).toEqual(["a", "b"]);
    expect(r.onlyB).toEqual(["c", "d"]);
  });

  it("scores a fully reversed ranked list with zero agreement", () => {
    const r = compareLists(ranked("a", "b", "c", "d", "e"), ranked("e", "d", "c", "b", "a"));
    expect(r.agreement).toBe(0);
    expect(r.tasteMatch).toBe(30); // overlap 1 * 0.3
    expect(["a", "e"]).toContain(r.biggestDisagreement);
  });

  it("measures agreement only on shared items, using their relative order", () => {
    // Shared items x,y appear in the same relative order despite other items in between.
    const r = compareLists(ranked("x", "p", "q", "y"), ranked("r", "x", "y"));
    expect(r.shared.map((s) => s.itemId)).toEqual(["x", "y"]);
    expect(r.agreement).toBe(1);
    expect(r.overlap).toBeCloseTo(2 / 5);
    expect(r.shared[0].a.position).toBe(1);
    expect(r.shared[0].b.position).toBe(2);
  });

  it("compares tier lists by tier distance", () => {
    const a = tiered({ a: 0, b: 1, c: 4 });
    const b = tiered({ a: 0, b: 2, c: 0 });
    const r = compareLists(a, b);
    // distances: a 0, b 0.25, c 1 → mean 0.4167
    expect(r.agreement).toBeCloseTo(1 - (0 + 0.25 + 1) / 3);
    expect(r.biggestDisagreement).toBe("c");
    expect(r.shared.find((s) => s.itemId === "c")?.b.tierIndex).toBe(0);
  });

  it("ignores unsorted tier items when scoring agreement but counts them as shared", () => {
    const r = compareLists(tiered({ a: 0, b: null }), tiered({ a: 0, b: 3 }));
    expect(r.shared).toHaveLength(2);
    expect(r.shared.find((s) => s.itemId === "b")?.distance).toBeNull();
    expect(r.agreement).toBe(1);
  });

  it("buckets a ranked list into tiers when compared with a tier list", () => {
    // 5 shared items, 5 tiers: ranked #1..#5 map to tiers S..D.
    const a = ranked("a", "b", "c", "d", "e");
    const b = tiered({ a: 0, b: 1, c: 2, d: 3, e: 4 });
    expect(compareLists(a, b).agreement).toBe(1);
    expect(compareLists(b, a).agreement).toBe(1);

    const flipped = tiered({ a: 4, b: 3, c: 2, d: 1, e: 0 });
    expect(compareLists(a, flipped).agreement).toBeCloseTo(1 - (1 + 0.5 + 0 + 0.5 + 1) / 5);
  });

  it("ignores gaps in ranks and leaves Not ranked yet items out of agreement", () => {
    // a: #1 a, #10 b, #11 c, pool d    b: #1 a, #2 b, #3 c, #4 d
    const gappy: CompareSide = {
      format: "ranked",
      tierCount: 0,
      entries: [
        { itemId: "a", tierIndex: null, rank: 1 },
        { itemId: "b", tierIndex: null, rank: 10 },
        { itemId: "c", tierIndex: null, rank: 11 },
        { itemId: "d", tierIndex: null, unranked: true },
      ],
    };
    const r = compareLists(gappy, ranked("a", "b", "c", "d"));
    expect(r.overlap).toBe(1); // d still counts as shared
    expect(r.agreement).toBe(1); // a, b, c are in the same relative order
    const d = r.shared.find((s) => s.itemId === "d")!;
    expect(d.distance).toBeNull();
    expect(d.a).toMatchObject({ unranked: true, rank: null });
    expect(r.shared.find((s) => s.itemId === "b")!.a.rank).toBe(10);
  });

  it("handles empty lists", () => {
    const r = compareLists(ranked(), ranked());
    expect(r.overlap).toBe(0);
    expect(r.agreement).toBeNull();
    expect(r.tasteMatch).toBe(0);
  });
});

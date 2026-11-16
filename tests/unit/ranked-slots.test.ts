import { describe, expect, it } from "vitest";
import {
  compact,
  fromEntries,
  hasGaps,
  insertNew,
  moveToPool,
  moveToSlot,
  toOrderPayload,
  type RankedState,
  type SlotEntry,
} from "@/lib/ranked-slots";

const e = (id: string, position: number, unranked = false): SlotEntry => ({ id, position, unranked });

/** "A B C - - D | x y" ↔ state, for readable assertions. */
function show(s: RankedState): string {
  const slots = s.slots.map((x) => x?.id ?? "-").join(" ");
  return s.pool.length ? `${slots} | ${s.pool.map((x) => x.id).join(" ")}` : slots;
}

function state(spec: string): RankedState {
  const [slotPart, poolPart = ""] = spec.split("|");
  const entries: SlotEntry[] = [];
  slotPart.trim().split(/\s+/).forEach((id, i) => id !== "-" && id !== "" && entries.push(e(id, i)));
  poolPart.trim().split(/\s+/).filter(Boolean).forEach((id, i) => entries.push(e(id, i, true)));
  return fromEntries(entries);
}

describe("ranked slots", () => {
  it("drops onto an empty slot without moving anything else", () => {
    expect(show(moveToSlot(state("A B C D E"), "C", 9))).toBe("A B - D E - - - - C");
  });

  it("inserts and pushes down to the first gap (the agreed example)", () => {
    expect(show(moveToSlot(state("A B C - - D"), "D", 1))).toBe("A D B C");
  });

  it("extends the end when there is no gap to absorb the push", () => {
    expect(show(moveToSlot(state("A B C"), "C", 0))).toBe("C A B");
    expect(show(moveToSlot(state("A B C D"), "A", 2))).toBe("- B A C D");
  });

  it("keeps gaps after the absorbing gap", () => {
    expect(show(moveToSlot(state("A B - C - - D"), "D", 0))).toBe("D A B C");
    expect(show(moveToSlot(state("A B - - C"), "E" as string, 0))).toBe("A B - - C"); // unknown id: no-op
  });

  it("moves between the pool and slots", () => {
    expect(show(moveToSlot(state("A B | x y"), "y", 0))).toBe("y A B | x");
    expect(show(moveToPool(state("A B C | x"), "B"))).toBe("A - C | x B");
    expect(show(moveToPool(state("A | x y"), "A", 0))).toBe(" | A x y");
  });

  it("compacts gaps and reports them", () => {
    const s = state("A - B - - C | x");
    expect(hasGaps(s)).toBe(true);
    expect(show(compact(s))).toBe("A B C | x");
    expect(hasGaps(compact(s))).toBe(false);
  });

  it("round-trips through the server payload", () => {
    const s = state("A - B - - C | x y");
    const payload = toOrderPayload(s);
    expect(payload).toEqual([
      { id: "A", tierId: null, position: 0, unranked: false },
      { id: "B", tierId: null, position: 2, unranked: false },
      { id: "C", tierId: null, position: 5, unranked: false },
      { id: "x", tierId: null, position: 0, unranked: true },
      { id: "y", tierId: null, position: 1, unranked: true },
    ]);
    expect(show(fromEntries(payload))).toBe("A - B - - C | x y");
  });

  it("nudges apart two entries that claim the same slot, and places new entries", () => {
    expect(show(fromEntries([e("A", 0), e("B", 0), e("C", 1)]))).toBe("A B C");
    expect(show(insertNew(state("A B"), e("N", 1)))).toBe("A B N");
    expect(show(insertNew(state("A - - B"), e("N", 4)))).toBe("A - - B N");
    expect(show(insertNew(state("A"), e("N", 0, true)))).toBe("A | N");
  });
});

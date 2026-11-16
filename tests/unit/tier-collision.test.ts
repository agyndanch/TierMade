import { describe, expect, it } from "vitest";
import { closestCorners, type ClientRect, type CollisionDetection } from "@dnd-kit/core";
import { tierCollision, tierKeyboardCoordinates } from "@/lib/tier-collision";

const rect = (left: number, top: number, width: number, height: number): ClientRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

/**
 * Board: three full-width tier rows (label 0–60px wide), covers on the left
 * of S and B, A empty, and the dragged cover u1 coming from "unsorted".
 */
const rects: Record<string, ClientRect> = {
  S: rect(0, 0, 600, 100),
  s1: rect(70, 10, 60, 80),
  s2: rect(140, 10, 60, 80),
  A: rect(0, 100, 600, 100),
  B: rect(0, 200, 600, 100),
  b1: rect(70, 210, 60, 80),
  unsorted: rect(0, 400, 600, 100),
  u1: rect(70, 410, 60, 80),
};
const members = { S: ["s1", "s2"], A: [], B: ["b1"], unsorted: ["u1"] };

/** Collision args with the dragged cover centred on the pointer (or no pointer = keyboard). */
function argsAt(pointer: { x: number; y: number } | null, center = pointer ?? { x: 100, y: 150 }) {
  const droppableRects = new Map(Object.entries(rects));
  return {
    active: { id: "u1", data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
    collisionRect: rect(center.x - 30, center.y - 40, 60, 80),
    droppableRects,
    droppableContainers: Object.keys(rects).map((id) => ({ id, key: id, data: { current: undefined }, disabled: false })),
    pointerCoordinates: pointer,
  } as unknown as Parameters<CollisionDetection>[0];
}

const firstId = (detect: CollisionDetection, args: Parameters<CollisionDetection>[0]) => String(detect(args)[0]?.id);

describe("tierCollision", () => {
  const detect = tierCollision(members);

  it("picks the tier under the pointer on the left side of an empty row (the old bug)", () => {
    const args = argsAt({ x: 100, y: 150 });
    // closestCorners: a neighbouring row's cover wins, which is what felt janky
    expect(["s1", "b1"]).toContain(firstId(closestCorners, args));
    expect(firstId(detect, args)).toBe("A");
  });

  it("counts the tier label as part of the tier", () => {
    expect(firstId(detect, argsAt({ x: 25, y: 150 }))).toBe("A"); // empty tier → the tier
    expect(firstId(detect, argsAt({ x: 25, y: 250 }))).toBe("b1"); // tier B, next to its first cover
  });

  it("returns the cover under the pointer, so the drop lands next to it", () => {
    expect(firstId(detect, argsAt({ x: 165, y: 50 }))).toBe("s2");
  });

  it("treats the dragged cover's own spot as a target, so dropping in place does nothing", () => {
    expect(firstId(detect, argsAt({ x: 100, y: 450 }))).toBe("u1");
  });

  it("uses the nearest cover in the tier, or the tier itself past the last cover", () => {
    expect(firstId(detect, argsAt({ x: 135, y: 95 }))).toBe("s1"); // in the gap below s1
    expect(firstId(detect, argsAt({ x: 450, y: 50 }))).toBe("S"); // right of the last cover → append
  });

  it("uses the dragged cover's centre when there's no pointer (keyboard dragging)", () => {
    expect(firstId(detect, argsAt(null, { x: 100, y: 150 }))).toBe("A");
    expect(firstId(detect, argsAt(null, { x: 165, y: 50 }))).toBe("s2");
  });

  it("jumps Up/Down to the next tier row with the keyboard", () => {
    const getter = tierKeyboardCoordinates(["S", "A", "B", "unsorted"]);
    const key = (code: string) => ({ code, preventDefault: () => {} }) as unknown as KeyboardEvent;
    const ctx = (center: { x: number; y: number }) =>
      ({ context: argsAt(null, center), active: "u1", currentCoordinates: { x: 0, y: 0 } }) as never;
    // from "unsorted" (y≈450): up lands in B, centred vertically, just past the label
    expect(getter(key("ArrowUp"), ctx({ x: 100, y: 450 }))).toEqual({ x: 72, y: 210 });
    // from A (y≈150): up is S, down is B; the current row is never the target
    expect(getter(key("ArrowUp"), ctx({ x: 100, y: 150 }))).toEqual({ x: 72, y: 10 });
    expect(getter(key("ArrowDown"), ctx({ x: 100, y: 150 }))).toEqual({ x: 72, y: 210 });
    // nothing above S
    expect(getter(key("ArrowUp"), ctx({ x: 100, y: 50 }))).toBeUndefined();
  });

  it("falls back to closestCorners outside every tier", () => {
    const args = argsAt({ x: 300, y: 350 }); // the gap between the tiers and "unsorted"
    expect(firstId(detect, args)).toBe(firstId(closestCorners, args));
  });
});

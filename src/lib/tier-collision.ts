import {
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * Collision detection for the tier board: the tier under the pointer always
 * wins. (dnd-kit's closestCorners compares corner distances, and since a tier
 * row is very wide while covers cluster on its left, a neighbouring row's
 * covers often "won" when dragging over the left side of a tier.)
 *
 *  - pointer over a cover            → that cover (insert next to it; the
 *                                      dragged cover's own spot = no-op)
 *  - pointer elsewhere inside a tier → the nearest cover in that tier, or the
 *                                      tier itself when the tier is empty or
 *                                      the pointer is past its last cover
 *                                      (append to the end)
 *  - keyboard dragging (no pointer)  → the same, using the dragged cover's centre
 *  - outside every tier              → closestCorners
 *
 * `members` maps each container id (tier id / "unsorted") to its cover ids, in order.
 */
export function tierCollision(members: Record<string, string[]>): CollisionDetection {
  const containerOf = (id: UniqueIdentifier): string | undefined => {
    const key = String(id);
    if (key in members) return key;
    return Object.keys(members).find((cid) => members[cid].includes(key));
  };

  return (args) => {
    const { collisionRect, droppableRects } = args;
    const p =
      args.pointerCoordinates ??
      (collisionRect ? { x: collisionRect.left + collisionRect.width / 2, y: collisionRect.top + collisionRect.height / 2 } : null);
    if (!p) return closestCorners(args);
    const hits = pointerWithin({ ...args, pointerCoordinates: p });
    if (hits.length === 0) return closestCorners(args);

    // The dragged cover's own spot counts too: dropping it there is a no-op,
    // which is what sortable expects when you pick something up and let go.
    const covers = new Set(Object.values(members).flat());
    const coverHit = hits.find((h) => covers.has(String(h.id)));
    if (coverHit) return [coverHit];

    const containerId = hits.map((h) => containerOf(h.id)).find((c): c is string => c !== undefined);
    if (!containerId) return closestCorners(args);

    // Nearest cover (by centre) in that container.
    const inside = members[containerId];
    let nearest: { id: string; dist: number; isLast: boolean; right: number } | null = null;
    inside.forEach((id, i) => {
      const r = droppableRects.get(id);
      if (!r) return;
      const dist = Math.hypot(r.left + r.width / 2 - p.x, r.top + r.height / 2 - p.y);
      if (!nearest || dist < nearest.dist) nearest = { id, dist, isLast: i === inside.length - 1, right: r.left + r.width };
    });
    const best = nearest as { id: string; isLast: boolean; right: number } | null;
    if (!best || (best.isLast && p.x > best.right)) return [{ id: containerId }];
    return [{ id: best.id }];
  };
}

/**
 * Keyboard moves for the tier board. Up/Down jump to the next tier row (the
 * stock sortable getter treats the current row as "above" the cover and never
 * leaves it); Left/Right move within the row as before.
 */
export function tierKeyboardCoordinates(containerIds: string[]): KeyboardCoordinateGetter {
  return (event, args) => {
    const dir = event.code === "ArrowUp" ? -1 : event.code === "ArrowDown" ? 1 : 0;
    if (!dir) return sortableKeyboardCoordinates(event, args);
    const { collisionRect, droppableRects } = args.context;
    if (!collisionRect) return undefined;
    event.preventDefault();
    const cy = collisionRect.top + collisionRect.height / 2;
    let target: { left: number; top: number; height: number } | null = null;
    let bestDy = Infinity;
    for (const id of containerIds) {
      const r = droppableRects.get(id);
      if (!r) continue;
      const inside = cy >= r.top && cy <= r.top + r.height;
      const dy = (r.top + r.height / 2 - cy) * dir;
      if (inside || dy <= 0) continue;
      if (dy < bestDy) {
        bestDy = dy;
        target = r;
      }
    }
    if (!target) return undefined;
    // Land just past the tier label, vertically centred in the row.
    return { x: target.left + 72, y: target.top + (target.height - collisionRect.height) / 2 };
  };
}

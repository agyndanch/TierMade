/**
 * Pure list-comparison scoring. No I/O — unit tested in compare.test.ts.
 *
 * Every entry is reduced to a "placement":
 *   - ranked lists: its order in the list (ranks can have gaps; only the
 *     relative order matters), or "not ranked yet"
 *   - tier lists:   its tier index (0 = top tier), or null if still unsorted
 * Not-ranked-yet / unsorted items count toward overlap but not agreement.
 */

export type CompareFormat = "ranked" | "tier";

export type CompareSide = {
  format: CompareFormat;
  /** number of tiers (tier lists only) */
  tierCount: number;
  /** entries in display order (ranked: by slot, "not ranked yet" last) */
  entries: {
    itemId: string;
    tierIndex: number | null;
    /** ranked lists: the displayed rank (#), which can skip numbers */
    rank?: number | null;
    /** ranked lists: waiting in "Not ranked yet" */
    unranked?: boolean;
  }[];
};

export type Placement = {
  /** 1-based position in display order */
  position: number;
  tierIndex: number | null;
  /** ranked lists: displayed rank (#); null when not ranked yet, or for tier lists */
  rank: number | null;
  /** ranked lists: waiting in "Not ranked yet" */
  unranked: boolean;
};

export type SharedItem = {
  itemId: string;
  a: Placement;
  b: Placement;
  /** 0 = same spot, 1 = opposite ends; null when one side is unsorted */
  distance: number | null;
};

export type ComparisonResult = {
  shared: SharedItem[];
  onlyA: string[];
  onlyB: string[];
  /** Jaccard similarity of the two item sets, 0..1 */
  overlap: number;
  /** How similarly the shared items are ordered, 0..1 (null with < 2 comparable items for ranked, < 1 for tiers) */
  agreement: number | null;
  /** Headline score, 0..100 */
  tasteMatch: number;
  biggestDisagreement: string | null;
};

function placements(side: CompareSide): Map<string, Placement> {
  const m = new Map<string, Placement>();
  side.entries.forEach((e, i) => {
    const ranked = side.format === "ranked";
    const unranked = ranked && Boolean(e.unranked);
    m.set(e.itemId, {
      position: i + 1,
      tierIndex: ranked ? null : e.tierIndex,
      rank: ranked && !unranked ? (e.rank ?? i + 1) : null,
      unranked,
    });
  });
  return m;
}

/**
 * Normalized score in [0,1] for each shared item (0 = best).
 * Ranked items are first re-ranked among the shared items only; when compared
 * against a tier list they're bucketed into that list's number of tiers.
 */
function normalizedScores(
  side: CompareSide,
  sharedIds: string[],
  otherSide: CompareSide,
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  if (side.format === "ranked") {
    // Only ranked items are scored; "not ranked yet" ones have no opinion yet.
    const pos = placements(side);
    for (const id of sharedIds) if (pos.get(id)!.unranked) out.set(id, null);
    const ordered = sharedIds
      .filter((id) => !pos.get(id)!.unranked)
      .sort((x, y) => pos.get(x)!.position - pos.get(y)!.position);
    const n = ordered.length;
    ordered.forEach((id, i) => {
      if (otherSide.format === "tier" && otherSide.tierCount > 1) {
        const bucket = Math.min(otherSide.tierCount - 1, Math.floor((i * otherSide.tierCount) / n));
        out.set(id, bucket / (otherSide.tierCount - 1));
      } else {
        out.set(id, n > 1 ? i / (n - 1) : 0);
      }
    });
  } else {
    const pos = placements(side);
    for (const id of sharedIds) {
      const t = pos.get(id)!.tierIndex;
      out.set(id, t === null ? null : side.tierCount > 1 ? t / (side.tierCount - 1) : 0);
    }
  }
  return out;
}

export function compareLists(a: CompareSide, b: CompareSide): ComparisonResult {
  const pa = placements(a);
  const pb = placements(b);

  const sharedIds = a.entries.map((e) => e.itemId).filter((id) => pb.has(id));
  const sharedSet = new Set(sharedIds);
  const onlyA = a.entries.map((e) => e.itemId).filter((id) => !sharedSet.has(id));
  const onlyB = b.entries.map((e) => e.itemId).filter((id) => !sharedSet.has(id));

  const unionSize = sharedIds.length + onlyA.length + onlyB.length;
  const overlap = unionSize === 0 ? 0 : sharedIds.length / unionSize;

  const sa = normalizedScores(a, sharedIds, b);
  const sb = normalizedScores(b, sharedIds, a);

  const shared: SharedItem[] = sharedIds.map((id) => {
    const x = sa.get(id);
    const y = sb.get(id);
    const distance = x == null || y == null ? null : Math.abs(x - y);
    return { itemId: id, a: pa.get(id)!, b: pb.get(id)!, distance };
  });

  const comparable = shared.filter((s) => s.distance !== null);
  let agreement: number | null = null;
  if (a.format === "ranked" && b.format === "ranked") {
    // Normalized Spearman footrule over the shared items' relative ranks.
    const n = comparable.length;
    if (n >= 2) {
      const ra = new Map([...comparable].sort((x, y) => x.a.position - y.a.position).map((s, i) => [s.itemId, i]));
      const rb = new Map([...comparable].sort((x, y) => x.b.position - y.b.position).map((s, i) => [s.itemId, i]));
      let footrule = 0;
      for (const s of comparable) footrule += Math.abs(ra.get(s.itemId)! - rb.get(s.itemId)!);
      const maxFootrule = Math.floor((n * n) / 2);
      agreement = 1 - footrule / maxFootrule;
    }
  } else if (comparable.length >= 1) {
    const mean = comparable.reduce((sum, s) => sum + (s.distance as number), 0) / comparable.length;
    agreement = 1 - mean;
  }

  let biggestDisagreement: string | null = null;
  let worst = 0;
  for (const s of comparable) {
    if ((s.distance as number) > worst) {
      worst = s.distance as number;
      biggestDisagreement = s.itemId;
    }
  }

  const tasteMatch = Math.round(100 * (agreement === null ? 0.3 * overlap : 0.3 * overlap + 0.7 * agreement));

  return { shared, onlyA, onlyB, overlap, agreement, tasteMatch, biggestDisagreement };
}

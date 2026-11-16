import { db, type DB } from "@/db";
import { badRequest } from "@/lib/errors";
import { compareLists, type CompareSide, type ComparisonResult } from "@/lib/compare";
import { getListDetail, type ListDetail } from "./lists";

export type ComparisonView = {
  a: ListDetail;
  b: ListDetail;
  result: ComparisonResult;
};

function toSide(detail: ListDetail): CompareSide {
  const tierIndex = new Map(detail.tiers.map((t, i) => [t.id, i]));
  return {
    format: detail.list.format,
    tierCount: detail.tiers.length,
    entries: detail.entries.map((e) => ({
      itemId: e.item.id,
      tierIndex: e.tierId ? (tierIndex.get(e.tierId) ?? null) : null,
      rank: detail.list.format === "ranked" && !e.unranked ? e.position + 1 : null,
      unranked: detail.list.format === "ranked" && e.unranked,
    })),
  };
}

export async function compareListsForViewer(
  listA: string,
  listB: string,
  viewerId: string,
  d: DB = db,
): Promise<ComparisonView> {
  if (listA === listB) throw badRequest("Pick two different lists to compare");
  const [a, b] = await Promise.all([getListDetail(listA, viewerId, d), getListDetail(listB, viewerId, d)]);
  if (a.list.category !== b.list.category) throw badRequest("Only lists in the same category can be compared");
  return { a, b, result: compareLists(toSide(a), toSide(b)) };
}

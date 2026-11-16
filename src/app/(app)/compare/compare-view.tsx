"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CategoryInfo } from "@/catalog/categories";
import type { List, ListTier } from "@/db/schema";
import type { EntryWithItem } from "@/repositories/entries";
import type { PublicUser } from "@/repositories/users";
import type { ComparisonResult, Placement } from "@/lib/compare";
import { Card, Cover } from "@/components/ui";
import { cn } from "@/lib/utils";

type Side = { list: List; owner: PublicUser; tiers: ListTier[]; entries: EntryWithItem[] };

function placementLabel(p: Placement, side: Side) {
  if (side.list.format === "ranked") return p.unranked ? "Not ranked" : `#${p.rank ?? p.position}`;
  if (p.tierIndex === null) return "Unsorted";
  return side.tiers[p.tierIndex]?.label ?? "?";
}

function matchWord(score: number) {
  if (score >= 85) return "Taste twins";
  if (score >= 65) return "Very similar";
  if (score >= 45) return "Some common ground";
  if (score >= 25) return "Pretty different";
  return "Opposites";
}

export function CompareView({
  viewerId,
  category,
  a,
  b,
  result,
}: {
  viewerId: string;
  category: CategoryInfo;
  a: Side;
  b: Side;
  result: ComparisonResult;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobileSide, setMobileSide] = useState<"a" | "b">("a");
  const shared = useMemo(() => new Map(result.shared.map((s) => [s.itemId, s])), [result.shared]);
  const itemTitle = (id: string) => a.entries.find((e) => e.item.id === id)?.item.title ?? "";
  const who = (side: Side) => (side.owner.id === viewerId ? "You" : `@${side.owner.username}`);
  const worst = result.biggestDisagreement ? shared.get(result.biggestDisagreement) : undefined;

  return (
    <div className="space-y-6">
      <Card className="grid gap-4 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        <div className="text-center sm:text-left">
          <p className="text-5xl font-bold tabular-nums tracking-tight text-accent">{result.tasteMatch}%</p>
          <p className="mt-1 text-sm font-medium">{matchWord(result.tasteMatch)}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">In common</dt>
            <dd className="font-semibold">
              {result.shared.length} {result.shared.length === 1 ? category.noun : `${category.noun}s`}
              <span className="ml-1 font-normal text-muted">({Math.round(result.overlap * 100)}% overlap)</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Agreement on shared</dt>
            <dd className="font-semibold">
              {result.agreement === null ? "Not enough overlap" : `${Math.round(result.agreement * 100)}%`}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-muted">Biggest disagreement</dt>
            <dd className="font-semibold">
              {worst ? (
                <>
                  {itemTitle(worst.itemId)}{" "}
                  <span className="font-normal text-muted">
                    ({placementLabel(worst.a, a)} vs {placementLabel(worst.b, b)})
                  </span>
                </>
              ) : (
                "None"
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 md:hidden" role="tablist">
        {(["a", "b"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={mobileSide === s}
            onClick={() => setMobileSide(s)}
            className={cn("rounded-md py-1.5 text-sm font-medium", mobileSide === s ? "bg-surface shadow-sm" : "text-muted")}
          >
            {who(s === "a" ? a : b)}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {(["a", "b"] as const).map((key) => {
          const side = key === "a" ? a : b;
          const other = key === "a" ? b : a;
          return (
            <section key={key} className={cn(mobileSide !== key && "hidden md:block")}>
              <header className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{who(side)}</p>
                <Link href={`/lists/${side.list.id}`} className="font-semibold hover:text-accent">
                  {side.list.title}
                </Link>
              </header>
              <CompareColumn
                side={side}
                sideKey={key}
                other={other}
                aspect={category.aspect}
                shared={shared}
                hovered={hovered}
                onHover={setHovered}
              />
            </section>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Highlighted items appear on both lists. The badge shows where the other list puts them. Hover an item to find
        it on the other side.
      </p>
    </div>
  );
}

function CompareColumn({
  side,
  sideKey,
  other,
  aspect,
  shared,
  hovered,
  onHover,
}: {
  side: Side;
  sideKey: "a" | "b";
  other: Side;
  aspect: "square" | "portrait";
  shared: Map<string, ComparisonResult["shared"][number]>;
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  if (side.entries.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">Empty list</p>;
  }

  const row = (e: EntryWithItem, label: string | null) => {
    const s = shared.get(e.item.id);
    const otherPlacement = s ? (sideKey === "a" ? s.b : s.a) : null;
    const isHovered = hovered === e.item.id;
    return (
      <li
        key={e.id}
        onMouseEnter={() => s && onHover(e.item.id)}
        onMouseLeave={() => onHover(null)}
        className={cn(
          "flex items-center gap-3 rounded-lg border p-1.5 pr-3 transition",
          s ? "border-accent/40 bg-accent-soft/40" : "border-border bg-surface",
          isHovered && "border-accent ring-2 ring-accent",
        )}
      >
        {label !== null && <span className="w-8 shrink-0 text-center font-bold tabular-nums text-muted">{label}</span>}
        <Cover src={e.item.imageUrl} alt={e.item.title} aspect={aspect} className={aspect === "square" ? "w-10" : "w-8"} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{e.item.title}</p>
          <p className="truncate text-xs text-muted">{[e.item.subtitle, e.item.year].filter(Boolean).join(" · ") || " "}</p>
        </div>
        {otherPlacement && (
          <span
            className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground"
            title={`${other.list.title}: ${placementLabel(otherPlacement, other)}`}
          >
            {placementLabel(otherPlacement, other)}
          </span>
        )}
      </li>
    );
  };

  if (side.list.format === "ranked") {
    const ranked = side.entries.filter((e) => !e.unranked);
    const pool = side.entries.filter((e) => e.unranked);
    return (
      <div className="space-y-3">
        <ol className="space-y-1.5">{ranked.map((e) => row(e, String(e.position + 1)))}</ol>
        {pool.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Not ranked yet</p>
            <ul className="space-y-1.5">{pool.map((e) => row(e, "–"))}</ul>
          </div>
        )}
      </div>
    );
  }

  const groups = [
    ...side.tiers.map((t) => ({ key: t.id, label: t.label, color: t.color, entries: side.entries.filter((e) => e.tierId === t.id) })),
    { key: "unsorted", label: "Unsorted", color: "transparent", entries: side.entries.filter((e) => !e.tierId) },
  ].filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key} className="flex gap-2">
          <div
            className={cn(
              "flex w-9 shrink-0 items-start justify-center rounded-md pt-2 text-sm font-bold",
              g.key === "unsorted" ? "bg-surface-2 text-muted [writing-mode:vertical-rl]" : "text-black/80",
            )}
            style={g.key === "unsorted" ? undefined : { background: g.color }}
          >
            {g.label}
          </div>
          <ul className="flex-1 space-y-1.5">{g.entries.map((e) => row(e, null))}</ul>
        </div>
      ))}
    </div>
  );
}

import Link from "next/link";
import { Lock, Plus, Users } from "lucide-react";
import { CATEGORIES, isCategoryId } from "@/catalog/categories";
import type { ListSummary } from "@/repositories/lists";
import { Badge } from "./ui";

/** A dashed "+ New list" card that sits in a grid of ListCards. */
export function NewListTile() {
  return (
    <Link
      href="/lists/new"
      className="group flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted transition hover:border-accent hover:bg-accent-soft/30 hover:text-accent"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 transition group-hover:bg-accent-soft">
        <Plus className="size-5" />
      </span>
      <span className="text-sm font-semibold">New list</span>
    </Link>
  );
}

export function ListCard({ list, showOwner = false }: { list: ListSummary; showOwner?: boolean }) {
  const category = isCategoryId(list.category) ? CATEGORIES[list.category] : null;
  return (
    <Link
      href={`/lists/${list.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-accent/60 hover:shadow-sm"
    >
      <div className="grid aspect-[2/1] grid-cols-4 gap-0.5 bg-surface-2">
        {Array.from({ length: 4 }).map((_, i) =>
          list.covers[i] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={list.covers[i]}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : (
            <div key={i} className="size-full bg-surface-2" />
          ),
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-accent">{list.title}</h3>
          {list.visibility === "private" ? (
            <Lock className="mt-0.5 size-3.5 shrink-0 text-muted" aria-label="Private" />
          ) : (
            <Users className="mt-0.5 size-3.5 shrink-0 text-muted" aria-label="Visible to friends" />
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {category && <Badge>{category.label}</Badge>}
          <Badge>{list.format === "tier" ? "Tier list" : "Ranked"}</Badge>
          <span className="text-xs text-muted">
            {list.entryCount} {list.entryCount === 1 ? "item" : "items"}
          </span>
        </div>
        {showOwner && <p className="text-xs text-muted">by @{list.ownerUsername}</p>}
      </div>
    </Link>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { CATEGORIES, CATEGORY_IDS } from "@/catalog/categories";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground focus:outline-2 focus:outline-accent";

/**
 * Search + filter bar for list grids. Everything lives in the URL query
 * (?q=&category=&format=&sort=&friend=), so results are shareable and Back works.
 * Any change resets paging.
 */
export function ListFilters({
  friends,
  className,
}: {
  /** show a friend picker (browse page) */
  friends?: { username: string; name: string }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Debounced title search.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const value = (k: string) => params.get(k) ?? "";
  const filtered = ["q", "category", "format", "friend"].some((k) => params.get(k)) || value("sort") === "title";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="search">
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search list titles…"
          aria-label="Search list titles"
          className="h-9 pl-9"
        />
      </div>
      {friends && (
        <select
          aria-label="Friend"
          className={selectClass}
          value={value("friend")}
          onChange={(e) => update({ friend: e.target.value || null })}
        >
          <option value="">All friends</option>
          {friends.map((f) => (
            <option key={f.username} value={f.username}>
              @{f.username}
              {f.name && f.name !== f.username ? ` (${f.name})` : ""}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Category"
        className={selectClass}
        value={value("category")}
        onChange={(e) => update({ category: e.target.value || null })}
      >
        <option value="">All categories</option>
        {CATEGORY_IDS.map((id) => (
          <option key={id} value={id}>
            {CATEGORIES[id].label}
          </option>
        ))}
      </select>
      <select
        aria-label="List type"
        className={selectClass}
        value={value("format")}
        onChange={(e) => update({ format: e.target.value || null })}
      >
        <option value="">Ranked & tier</option>
        <option value="ranked">Ranked</option>
        <option value="tier">Tier lists</option>
      </select>
      <select
        aria-label="Sort"
        className={selectClass}
        value={value("sort") || "recent"}
        onChange={(e) => update({ sort: e.target.value === "title" ? "title" : null })}
      >
        <option value="recent">Recently updated</option>
        <option value="title">A–Z</option>
      </select>
      {filtered && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            first.current = true;
            const keep = params.get("tab");
            router.replace(keep ? `${pathname}?tab=${keep}` : pathname, { scroll: false });
          }}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-foreground"
        >
          <X className="size-3.5" /> Clear
        </button>
      )}
    </div>
  );
}

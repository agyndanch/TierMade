"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, PencilLine, Plus, Search } from "lucide-react";
import type { CategoryInfo } from "@/catalog/categories";
import type { CatalogResult } from "@/catalog/types";
import { Cover, Input } from "@/components/ui";
import { api, cn } from "@/lib/utils";
import { CustomItemForm } from "./custom-item-form";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Search the category's external database; one click adds a result. */
export function SearchPanel({
  category,
  addedExternalIds,
  pendingExternalIds,
  onAdd,
  onAddCustom,
}: {
  category: CategoryInfo;
  addedExternalIds: Set<string>;
  pendingExternalIds: Set<string>;
  onAdd: (result: CatalogResult) => void;
  /** resolves true when the custom item was added */
  onAddCustom: (form: FormData) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const q = useDebounced(query.trim(), 300);

  const { data, error, isFetching } = useQuery({
    queryKey: ["search", category.id, q],
    queryFn: ({ signal }) =>
      api<{ results: CatalogResult[] }>(`/api/search?category=${category.id}&q=${encodeURIComponent(q)}`, { signal }),
    enabled: q.length > 0,
  });

  const results = q.length > 0 ? (data?.results ?? []) : [];
  const noResults = !error && q.length > 0 && !isFetching && results.length === 0;

  if (customOpen) {
    return (
      <CustomItemForm
        category={category}
        initialTitle={query.trim()}
        onCancel={() => setCustomOpen(false)}
        onSubmit={async (form) => {
          const ok = await onAddCustom(form);
          if (ok) setCustomOpen(false);
          return ok;
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search for ${/^[aeiou]/.test(category.noun) ? "an" : "a"} ${category.noun}…`}
          aria-label={`Search ${category.label}`}
          className="pl-9"
        />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
      </div>

      {error && <p className="text-sm text-danger">{error.message}</p>}
      {!error && q.length === 0 && <p className="text-sm text-muted">{category.placeholder}</p>}
      {noResults && <p className="text-sm text-muted">No results for “{q}”.</p>}

      <ul className="flex flex-col gap-1" aria-label="Search results">
        {results.map((r) => {
          const added = addedExternalIds.has(r.externalId);
          const pending = pendingExternalIds.has(r.externalId);
          return (
            <li key={r.externalId}>
              <button
                type="button"
                disabled={added || pending}
                onClick={() => onAdd(r)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition",
                  added ? "opacity-60" : "hover:bg-surface-2",
                )}
              >
                <Cover src={r.imageUrl} alt={r.title} aspect={category.aspect} className={category.aspect === "square" ? "w-11" : "w-9"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {[r.subtitle, r.year].filter(Boolean).join(" · ") || " "}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    added ? "text-success" : "bg-accent-soft text-accent",
                  )}
                  aria-hidden
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : added ? (
                    <Check className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </span>
                <span className="sr-only">{added ? "Already on your list" : `Add ${r.title}`}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setCustomOpen(true)}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-lg text-sm",
          noResults
            ? "border border-dashed border-border py-2.5 font-medium hover:border-accent hover:text-accent"
            : "py-1 text-muted hover:text-foreground",
        )}
      >
        <PencilLine className="size-4" />
        {q.length > 0 ? "Can’t find it? Add it yourself" : `Add a custom ${category.noun}`}
      </button>
    </div>
  );
}

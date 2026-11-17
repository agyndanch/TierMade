"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, PencilLine, Plus, Search } from "lucide-react";
import {
  CATALOG_CATEGORY_IDS,
  CATEGORIES,
  isCatalogCategory,
  type CatalogCategoryId,
  type CategoryInfo,
} from "@/catalog/categories";
import { CATEGORY_ICONS } from "@/catalog/category-icons";
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

/** Key for "is this result already on the list?": the same id can exist in two sources. */
export const resultKey = (source: string, externalId: string) => `${source}:${externalId}`;

/**
 * "Anything" lists: the source to search, remembered per browser. A tiny external
 * store over localStorage (with an in-memory fallback when storage is blocked);
 * the server always renders the default, so hydration matches.
 */
const SOURCE_KEY = "tiermade:anything-source";
const DEFAULT_SOURCE: CatalogCategoryId = "albums";
let memorySource: CatalogCategoryId = DEFAULT_SOURCE;
const sourceListeners = new Set<() => void>();

function readSource(): CatalogCategoryId {
  try {
    const saved = window.localStorage.getItem(SOURCE_KEY);
    return isCatalogCategory(saved) ? saved : memorySource;
  } catch {
    return memorySource;
  }
}
function subscribeSource(cb: () => void) {
  sourceListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    sourceListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function writeSource(s: CatalogCategoryId) {
  memorySource = s;
  try {
    window.localStorage.setItem(SOURCE_KEY, s);
  } catch {
    // storage unavailable: remembered only for this visit
  }
  sourceListeners.forEach((l) => l());
}

function useSource(category: CategoryInfo): [CatalogCategoryId, (s: CatalogCategoryId) => void] {
  const chosen = useSyncExternalStore(subscribeSource, readSource, () => DEFAULT_SOURCE);
  return [isCatalogCategory(category.id) ? category.id : chosen, writeSource];
}

/** Search the category's external database (or a chosen one, for "anything" lists); one click adds a result. */
export function SearchPanel({
  category,
  addedKeys,
  pendingKeys,
  onAdd,
  onAddCustom,
}: {
  category: CategoryInfo;
  /** resultKey(source, externalId) of items already on the list */
  addedKeys: Set<string>;
  pendingKeys: Set<string>;
  onAdd: (result: CatalogResult, source: CatalogCategoryId) => void;
  /** resolves true when the custom item was added */
  onAddCustom: (form: FormData) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const q = useDebounced(query.trim(), 300);
  const [source, setSource] = useSource(category);
  const mixed = !isCatalogCategory(category.id);
  const searching = CATEGORIES[source];

  const { data, error, isFetching } = useQuery({
    queryKey: ["search", source, q],
    queryFn: ({ signal }) =>
      api<{ results: CatalogResult[] }>(`/api/search?category=${source}&q=${encodeURIComponent(q)}`, { signal }),
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
      {mixed && (
        <div role="radiogroup" aria-label="Search in" className="flex flex-wrap gap-1.5">
          {CATALOG_CATEGORY_IDS.map((id) => {
            const Icon = CATEGORY_ICONS[id];
            const on = id === source;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSource(id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                  on
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted hover:border-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {CATEGORIES[id].label}
              </button>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search for ${/^[aeiou]/.test(searching.noun) ? "an" : "a"} ${searching.noun}…`}
          aria-label={`Search ${searching.label}`}
          className="pl-9"
        />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
      </div>

      {error && <p className="text-sm text-danger">{error.message}</p>}
      {!error && q.length === 0 && <p className="text-sm text-muted">{mixed ? searching.placeholder : category.placeholder}</p>}
      {noResults && <p className="text-sm text-muted">No results for “{q}”.</p>}

      <ul className="flex flex-col gap-1" aria-label="Search results">
        {results.map((r) => {
          const added = addedKeys.has(resultKey(source, r.externalId));
          const pending = pendingKeys.has(resultKey(source, r.externalId));
          return (
            <li key={r.externalId}>
              <button
                type="button"
                disabled={added || pending}
                onClick={() => onAdd(r, source)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition",
                  added ? "opacity-60" : "hover:bg-surface-2",
                )}
              >
                <Cover
                  src={r.imageUrl}
                  alt={r.title}
                  aspect={searching.aspect}
                  className={searching.aspect === "square" ? "w-11" : "w-9"}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  {typeof r.metadata?.altTitle === "string" && (
                    <span className="block truncate text-xs italic text-muted">{r.metadata.altTitle}</span>
                  )}
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

import Link from "next/link";
import type { ListSummary } from "@/repositories/lists";
import { ListCard } from "@/components/list-card";
import { buttonClass } from "@/components/ui";

/** Builds a query string from page params, overriding some keys. */
export function withParams(
  base: string,
  params: Record<string, string | string[] | undefined>,
  patch: Record<string, string | null>,
) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v) next.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v) next.set(k, v);
    else next.delete(k);
  }
  const qs = next.toString();
  return qs ? `${base}?${qs}` : base;
}

/** A grid of list cards with a "Load more" link for the next page. */
export function ListResults({
  lists,
  hasMore,
  loadMoreHref,
  showOwner,
  empty,
}: {
  lists: ListSummary[];
  hasMore: boolean;
  loadMoreHref: string;
  showOwner?: boolean;
  empty: React.ReactNode;
}) {
  if (lists.length === 0) {
    return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">{empty}</div>;
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {lists.map((l) => (
          <ListCard key={l.id} list={l} showOwner={showOwner} />
        ))}
      </div>
      {hasMore && (
        <div className="text-center">
          <Link href={loadMoreHref} scroll={false} className={buttonClass("secondary")}>
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { listFiltersSchema } from "@/lib/validation";
import { searchLists } from "@/repositories/lists";
import { buttonClass } from "@/components/ui";
import { ListFilters } from "@/components/list-filters";
import { ListResults, withParams } from "@/components/list-results";

export const metadata = { title: "My lists" };

const PAGE_SIZE = 24;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Every list you've made, searchable and filterable. */
export default async function MyListsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const f = listFiltersSchema.parse(params);
  const filtering = Boolean(f.q || f.category || f.format);

  const { lists, hasMore } = await searchLists(user.id, {
    ownerId: user.id,
    category: f.category,
    format: f.format,
    q: f.q,
    sort: f.sort,
    limit: f.page * PAGE_SIZE,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">My lists</h1>
          <p className="text-sm text-muted">Everything you&rsquo;ve made, private ones included.</p>
        </div>
        <Link href="/lists/new" className={buttonClass("primary")}>
          <Plus className="size-4" /> New list
        </Link>
      </div>
      <Suspense>
        <ListFilters />
      </Suspense>
      <ListResults
        lists={lists}
        hasMore={hasMore}
        loadMoreHref={withParams("/lists", params, { page: String(f.page + 1) })}
        empty={
          filtering ? (
            "No lists match these filters."
          ) : (
            <>
              <p className="font-medium text-foreground">No lists yet</p>
              <p className="mt-1">Pick a category, search, click to add. Ranking takes seconds.</p>
              <Link href="/lists/new" className={buttonClass("primary", "md", "mt-4")}>
                Make your first list
              </Link>
            </>
          )
        }
      />
    </div>
  );
}

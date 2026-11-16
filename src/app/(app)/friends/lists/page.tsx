import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { listFiltersSchema } from "@/lib/validation";
import { searchLists } from "@/repositories/lists";
import { getFriendsOverview } from "@/services/friends";
import { ListFilters } from "@/components/list-filters";
import { ListResults, withParams } from "@/components/list-results";

export const metadata = { title: "Friends' lists" };

const PAGE_SIZE = 24;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Every list your friends have shared with you, searchable and filterable. */
export default async function FriendsListsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const f = listFiltersSchema.parse(params);
  const { friends } = await getFriendsOverview(user.id);
  const wanted = f.friend?.toLowerCase();
  const friend = wanted ? friends.find((x) => x.username === wanted) : undefined;

  const { lists, hasMore } =
    f.friend && !friend
      ? { lists: [], hasMore: false } // not a friend of yours: nothing to show
      : await searchLists(user.id, {
          ownerId: friend?.id,
          category: f.category,
          format: f.format,
          q: f.q,
          sort: f.sort,
          limit: f.page * PAGE_SIZE,
        });

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link href="/friends" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> Friends
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Friends&rsquo; lists</h1>
        <p className="text-sm text-muted">Everything your friends have shared with you.</p>
      </div>
      <Suspense>
        <ListFilters friends={friends.map((x) => ({ username: x.username, name: x.name }))} />
      </Suspense>
      <ListResults
        lists={lists}
        hasMore={hasMore}
        showOwner
        loadMoreHref={withParams("/friends/lists", params, { page: String(f.page + 1) })}
        empty={
          friends.length === 0 ? (
            <>
              No friends yet.{" "}
              <Link href="/friends" className="font-medium text-accent hover:underline">
                Add some
              </Link>{" "}
              to see their lists here.
            </>
          ) : (
            "No lists match these filters."
          )
        }
      />
    </div>
  );
}

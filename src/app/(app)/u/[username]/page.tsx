import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HttpError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { listFiltersSchema } from "@/lib/validation";
import { searchLists } from "@/repositories/lists";
import { getProfile, getProfileFriends, type Profile } from "@/services/profiles";
import { Avatar, Badge, buttonClass } from "@/components/ui";
import { ListFilters } from "@/components/list-filters";
import { ListResults, withParams } from "@/components/list-results";
import { ProfileActions } from "./profile-actions";

const PAGE_SIZE = 24;
const TABS = ["overview", "lists", "friends"] as const;
type Tab = (typeof TABS)[number];

type Params = Promise<{ username: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function load(username: string, viewerId: string): Promise<Profile> {
  try {
    return await getProfile(decodeURIComponent(username), viewerId);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }) {
  const { username } = await params;
  const viewer = await requireUser();
  const { user } = await load(username, viewer.id);
  return { title: `${user.name} (@${user.username})` };
}

export default async function ProfilePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const viewer = await requireUser();
  const { username } = await params;
  const query = await searchParams;
  const profile = await load(username, viewer.id);
  const { user, relationship, stats } = profile;
  const tab: Tab = TABS.includes(query.tab as Tab) ? (query.tab as Tab) : "overview";
  const base = `/u/${user.username}`;
  const isSelf = relationship === "self";
  const joined = user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar name={user.name || user.username} src={user.image} className="size-20 text-3xl sm:size-24" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <h1 className="truncate text-2xl font-bold tracking-tight">{user.name}</h1>
            <p className="text-sm text-muted">
              @{user.username} · Joined {joined}
            </p>
          </div>
          {user.bio && <p className="max-w-prose whitespace-pre-line text-sm">{user.bio}</p>}
          <p className="flex gap-4 text-sm">
            <span>
              <span className="font-semibold">{stats.lists}</span>{" "}
              <span className="text-muted">{isSelf ? "lists" : "lists you can see"}</span>
            </span>
            <span>
              <span className="font-semibold">{stats.friends}</span>{" "}
              <span className="text-muted">{stats.friends === 1 ? "friend" : "friends"}</span>
            </span>
          </p>
        </div>
        <ProfileActions
          relationship={relationship}
          userId={user.id}
          username={user.username}
          requestId={profile.requestId}
        />
      </header>

      <nav className="flex gap-1 border-b border-border" aria-label="Profile sections">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "overview" ? base : `${base}?tab=${t}`}
            aria-current={tab === t ? "page" : undefined}
            scroll={false}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition",
              tab === t ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t}
            {t === "lists" && <span className="ml-1.5 text-xs text-muted">{stats.lists}</span>}
            {t === "friends" && <span className="ml-1.5 text-xs text-muted">{stats.friends}</span>}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab profile={profile} viewerId={viewer.id} base={base} />}
      {tab === "lists" && <ListsTab profile={profile} viewerId={viewer.id} base={base} query={query} />}
      {tab === "friends" && <FriendsTab profile={profile} viewerId={viewer.id} />}
    </div>
  );
}

/** What to show instead of lists when the viewer can't see any. */
function NoLists({ profile }: { profile: Profile }) {
  const { relationship, user } = profile;
  if (relationship === "self") {
    return (
      <>
        You haven&rsquo;t made any lists yet.{" "}
        <Link href="/lists/new" className="font-medium text-accent hover:underline">
          Make one
        </Link>
      </>
    );
  }
  if (relationship === "friends") return <>@{user.username} hasn&rsquo;t shared any lists with you yet.</>;
  return <>Add @{user.username} as a friend to see the lists they share.</>;
}

async function OverviewTab({ profile, viewerId, base }: { profile: Profile; viewerId: string; base: string }) {
  const { lists, hasMore } = await searchLists(viewerId, { ownerId: profile.user.id, limit: 6 });
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Recently updated</h2>
        {hasMore && (
          <Link href={`${base}?tab=lists`} className="text-sm font-medium text-accent hover:underline">
            See all {profile.stats.lists} lists →
          </Link>
        )}
      </div>
      <ListResults lists={lists} hasMore={false} loadMoreHref="" empty={<NoLists profile={profile} />} />
    </section>
  );
}

async function ListsTab({
  profile,
  viewerId,
  base,
  query,
}: {
  profile: Profile;
  viewerId: string;
  base: string;
  query: Record<string, string | string[] | undefined>;
}) {
  if (profile.stats.lists === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
        <NoLists profile={profile} />
      </div>
    );
  }
  const f = listFiltersSchema.parse(query);
  const { lists, hasMore } = await searchLists(viewerId, {
    ownerId: profile.user.id,
    category: f.category,
    format: f.format,
    q: f.q,
    sort: f.sort,
    limit: f.page * PAGE_SIZE,
  });
  return (
    <section className="space-y-4">
      <Suspense>
        <ListFilters />
      </Suspense>
      <ListResults
        lists={lists}
        hasMore={hasMore}
        loadMoreHref={withParams(base, query, { page: String(f.page + 1) })}
        empty="No lists match these filters."
      />
    </section>
  );
}

async function FriendsTab({ profile, viewerId }: { profile: Profile; viewerId: string }) {
  const friends = await getProfileFriends(profile.user.id, viewerId);
  if (!friends) {
    return (
      <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
        Only @{profile.user.username}&rsquo;s friends can see who they&rsquo;re friends with.
      </p>
    );
  }
  if (friends.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
        No friends yet.
        {profile.relationship === "self" && (
          <div className="mt-3">
            <Link href="/friends" className={buttonClass("secondary", "sm")}>
              Find friends
            </Link>
          </div>
        )}
      </div>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {friends.map((f) => (
        <li key={f.id}>
          <Link
            href={`/u/${f.username}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-accent/60"
          >
            <Avatar name={f.name || f.username} src={f.image} className="size-10" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{f.name}</span>
              <span className="block truncate text-xs text-muted">@{f.username}</span>
            </span>
            {f.id === viewerId ? <Badge>You</Badge> : f.mutual && <Badge>Mutual</Badge>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

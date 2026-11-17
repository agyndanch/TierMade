import Link from "next/link";
import { requireUser } from "@/lib/session";
import { searchLists } from "@/repositories/lists";
import { ListCard, NewListTile } from "@/components/list-card";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Home" };

/** 7 of yours + the New list tile = two even rows of 4; friends' row shows 8. */
const MY_RECENT = 7;
const FRIENDS_RECENT = 8;

/** Section header: title on the left, a "→" link on the right (same for both sections). */
function SectionHeader({
  as: Heading,
  title,
  href,
  linkText,
}: {
  as: "h1" | "h2";
  title: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <Heading className="text-xl font-semibold tracking-tight">{title}</Heading>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-medium text-accent hover:underline">
          {linkText} →
        </Link>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [own, friends] = await Promise.all([
    searchLists(user.id, { ownerId: user.id, limit: MY_RECENT }),
    searchLists(user.id, { limit: FRIENDS_RECENT }),
  ]);
  const { lists: mine, hasMore: hasMoreMine } = own;
  const { lists: shared, hasMore: hasMoreShared } = friends;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader
          as="h1"
          title="Your recent lists"
          href={mine.length > 0 ? "/lists" : undefined}
          linkText={hasMoreMine ? "See all" : "Search & filter"}
        />
        {mine.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-medium">No lists yet</p>
            <p className="mt-1 text-sm text-muted">Pick a category, search, click to add. Ranking takes seconds.</p>
            <Link href="/lists/new" className={buttonClass("primary", "md", "mt-4")}>
              Make your first list
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <NewListTile />
            {mine.map((l) => (
              <ListCard key={l.id} list={l} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          as="h2"
          title="Recently updated by friends"
          href={shared.length > 0 ? "/friends/lists" : undefined}
          linkText={hasMoreShared ? "See all" : "Search & filter"}
        />
        {shared.length === 0 ? (
          <p className="text-sm text-muted">
            Lists your friends share with you show up here.{" "}
            <Link href="/friends" className="font-medium text-accent hover:underline">
              Add friends
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shared.map((l) => (
              <ListCard key={l.id} list={l} showOwner />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

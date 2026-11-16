import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Users } from "lucide-react";
import { CATEGORIES, isCategoryId } from "@/catalog/categories";
import { HttpError } from "@/lib/errors";
import type { ListDisplay } from "@/lib/list-display";
import { requireUser } from "@/lib/session";
import { listsByOwner, listsVisibleToUser } from "@/repositories/lists";
import { getFriendsOverview } from "@/services/friends";
import { getListDetail, getShares } from "@/services/lists";
import { Badge } from "@/components/ui";
import { ListEditor } from "@/components/list/list-editor";
import { StaticBoard } from "@/components/list/static-board";
import { EditableTitle, OwnerActions } from "@/components/list/list-toolbar";
import { CompareMenu, type CompareCandidate } from "@/components/list/compare-menu";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string, userId: string) {
  if (!UUID.test(id)) notFound();
  try {
    return await getListDetail(id, userId);
  } catch (e) {
    if (e instanceof HttpError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const detail = await load(id, user.id);
  return { title: detail.list.title };
}

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { list, owner, tiers, entries, isOwner } = await load(id, user.id);
  const category = isCategoryId(list.category) ? CATEGORIES[list.category] : null;
  if (!category) notFound();
  const display: ListDisplay = {
    view: list.view,
    gridColumns: list.gridColumns,
    gridRows: list.gridRows,
    showNumbers: list.showNumbers,
  };

  // Lists this one can be compared against: same category, on the "other" side.
  const candidates: CompareCandidate[] = isOwner
    ? (await listsVisibleToUser(user.id)).filter((l) => l.category === list.category)
    : (await listsByOwner(user.id)).filter((l) => l.category === list.category);

  const [friends, shares] = isOwner
    ? await Promise.all([getFriendsOverview(user.id), getShares(list.id, user.id)])
    : [null, []];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> All lists
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            {isOwner ? (
              <EditableTitle listId={list.id} initial={list.title} />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight">{list.title}</h1>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
              <Badge>{category.label}</Badge>
              <Badge>{list.format === "tier" ? "Tier list" : "Ranked"}</Badge>
              {isOwner ? (
                <span className="inline-flex items-center gap-1 text-xs">
                  {list.visibility === "private" ? <Lock className="size-3" /> : <Users className="size-3" />}
                  {list.visibility === "private" ? "Private" : "Friends can see"}
                </span>
              ) : (
                <span className="text-xs">by @{owner.username}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CompareMenu
              thisListId={list.id}
              isOwner={isOwner}
              candidates={candidates.map((c) => ({
                id: c.id,
                title: c.title,
                ownerUsername: c.ownerUsername,
                entryCount: c.entryCount,
              }))}
              createHref={`/lists/new?category=${list.category}`}
            />
            {isOwner && friends && (
              <OwnerActions
                listId={list.id}
                visibility={list.visibility}
                friends={friends.friends}
                sharedWith={shares.map((s) => s.id)}
              />
            )}
          </div>
        </div>
      </div>

      {isOwner ? (
        <ListEditor
          key={list.updatedAt.toISOString()}
          listId={list.id}
          format={list.format}
          tiers={tiers}
          initialEntries={entries}
          initialDisplay={display}
          category={category}
        />
      ) : (
        <StaticBoard format={list.format} tiers={tiers} entries={entries} aspect={category.aspect} display={display} />
      )}
    </div>
  );
}

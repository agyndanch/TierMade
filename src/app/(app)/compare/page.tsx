import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CATEGORIES, isCategoryId } from "@/catalog/categories";
import { HttpError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { compareQuerySchema } from "@/lib/validation";
import { compareListsForViewer } from "@/services/compare";
import { CompareView } from "./compare-view";

export const metadata = { title: "Compare" };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const parsed = compareQuerySchema.safeParse(await searchParams);
  if (!parsed.success) notFound();

  let view;
  try {
    view = await compareListsForViewer(parsed.data.a, parsed.data.b, user.id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 400) {
      return (
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="font-medium">{e.message}</p>
          <Link href="/lists" className="mt-3 inline-block text-sm text-accent hover:underline">
            Back to your lists
          </Link>
        </div>
      );
    }
    if (e instanceof HttpError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }

  const category = isCategoryId(view.a.list.category) ? CATEGORIES[view.a.list.category] : null;
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/lists/${view.b.list.ownerId === user.id ? view.b.list.id : view.a.list.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to list
      </Link>
      <CompareView
        viewerId={user.id}
        category={category}
        a={{ list: view.a.list, owner: view.a.owner, tiers: view.a.tiers, entries: view.a.entries }}
        b={{ list: view.b.list, owner: view.b.owner, tiers: view.b.tiers, entries: view.b.entries }}
        result={view.result}
      />
    </div>
  );
}

import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { listsByOwner, listsVisibleToUser } from "@/repositories/lists";
import { ListCard } from "@/components/list-card";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Your lists" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [mine, shared] = await Promise.all([listsByOwner(user.id), listsVisibleToUser(user.id)]);

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Your lists</h1>
          <Link href="/lists/new" className={buttonClass("primary")}>
            <Plus className="size-4" /> New list
          </Link>
        </div>
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
            {mine.map((l) => (
              <ListCard key={l.id} list={l} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">From your friends</h2>
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

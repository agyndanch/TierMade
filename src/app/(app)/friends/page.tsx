import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { getFriendsOverview } from "@/services/friends";
import { FriendsClient } from "./friends-client";

export const metadata = { title: "Friends" };

export default async function FriendsPage() {
  const user = await requireUser();
  const overview = await getFriendsOverview(user.id);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
        {overview.friends.length > 0 && (
          <Link href="/friends/lists" className={buttonClass("secondary", "sm")}>
            <LayoutGrid className="size-4" /> Browse friends&rsquo; lists
          </Link>
        )}
      </div>
      <FriendsClient overview={overview} />
    </div>
  );
}

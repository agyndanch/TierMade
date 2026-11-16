import { requireUser } from "@/lib/session";
import { getFriendsOverview } from "@/services/friends";
import { FriendsClient } from "./friends-client";

export const metadata = { title: "Friends" };

export default async function FriendsPage() {
  const user = await requireUser();
  const overview = await getFriendsOverview(user.id);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Friends</h1>
      <FriendsClient overview={overview} />
    </div>
  );
}

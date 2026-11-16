import { handle, json, requireApiUser } from "@/lib/http";
import { getFriendsOverview } from "@/services/friends";

export const GET = handle(async () => {
  const user = await requireApiUser();
  return json(await getFriendsOverview(user.id));
});

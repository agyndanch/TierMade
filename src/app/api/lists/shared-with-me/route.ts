import { handle, json, requireApiUser } from "@/lib/http";
import { listsVisibleToUser } from "@/repositories/lists";

export const GET = handle(async () => {
  const user = await requireApiUser();
  return json({ lists: await listsVisibleToUser(user.id) });
});

import { handle, json, parseJson, requireApiUser } from "@/lib/http";
import { friendRequestSchema } from "@/lib/validation";
import { sendFriendRequest } from "@/services/friends";

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { username } = await parseJson(req, friendRequestSchema);
  return json(await sendFriendRequest(user.id, username), 201);
});

import { handle, json, parseJson, requireApiUser } from "@/lib/http";
import { createListSchema } from "@/lib/validation";
import { listsByOwner } from "@/repositories/lists";
import { createList } from "@/services/lists";

export const GET = handle(async () => {
  const user = await requireApiUser();
  return json({ lists: await listsByOwner(user.id) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const input = await parseJson(req, createListSchema);
  const list = await createList(user.id, input);
  return json({ list }, 201);
});

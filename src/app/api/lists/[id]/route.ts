import { handle, json, parseJson, requireApiUser } from "@/lib/http";
import { updateListSchema } from "@/lib/validation";
import { deleteList, getListDetail, updateList } from "@/services/lists";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  return json(await getListDetail(id, user.id));
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const patch = await parseJson(req, updateListSchema);
  return json({ list: await updateList(id, user.id, patch) });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  await deleteList(id, user.id);
  return new Response(null, { status: 204 });
});

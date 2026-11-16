import { handle, json, parseJson, requireApiUser } from "@/lib/http";
import { shareSchema } from "@/lib/validation";
import { getShares, shareList, unshareList } from "@/services/lists";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  return json({ users: await getShares(id, user.id) });
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { userId } = await parseJson(req, shareSchema);
  await shareList(id, user.id, userId);
  return json({ ok: true }, 201);
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { userId } = await parseJson(req, shareSchema);
  await unshareList(id, user.id, userId);
  return new Response(null, { status: 204 });
});

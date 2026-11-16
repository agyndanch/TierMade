import { handle, json, parseJson, requireApiUser } from "@/lib/http";
import { reorderSchema } from "@/lib/validation";
import { reorderList } from "@/services/lists";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { entries } = await parseJson(req, reorderSchema);
  await reorderList(id, user.id, entries);
  return json({ ok: true });
});

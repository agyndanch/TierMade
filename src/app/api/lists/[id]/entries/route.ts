import { getAdapter } from "@/catalog/registry";
import { handle, json, parseJson, requireApiUser } from "@/lib/http";
import { addEntrySchema } from "@/lib/validation";
import { addItemToList } from "@/services/lists";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { externalId, tierId, itemCategory } = await parseJson(req, addEntrySchema);
  const entry = await addItemToList(id, user.id, externalId, tierId ?? null, getAdapter, itemCategory ?? null);
  return json({ entry }, 201);
});

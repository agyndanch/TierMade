import { getAdapter } from "@/catalog/registry";
import type { CategoryId } from "@/catalog/categories";
import { handle, json, parseJson, requireApiUser } from "@/lib/http";
import { addEntrySchema } from "@/lib/validation";
import { addItemToList } from "@/services/lists";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { externalId, tierId } = await parseJson(req, addEntrySchema);
  const entry = await addItemToList(id, user.id, externalId, tierId ?? null, (c) => getAdapter(c as CategoryId));
  return json({ entry }, 201);
});

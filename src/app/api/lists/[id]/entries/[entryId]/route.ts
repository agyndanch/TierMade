import { handle, json, parseJson, requireApiUser } from "@/lib/http";
import { entryLabelsSchema } from "@/lib/validation";
import { removeEntry, renameEntry } from "@/services/lists";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

/** Set this list's own names for an entry: { displayTitle, displaySubtitle } (null/blank = the catalog's). */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id, entryId } = await params;
  const labels = await parseJson(req, entryLabelsSchema);
  return json({ entry: await renameEntry(id, user.id, entryId, labels) });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id, entryId } = await params;
  await removeEntry(id, user.id, entryId);
  return new Response(null, { status: 204 });
});

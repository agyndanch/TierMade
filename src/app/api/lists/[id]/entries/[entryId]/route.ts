import { handle, requireApiUser } from "@/lib/http";
import { removeEntry } from "@/services/lists";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id, entryId } = await params;
  await removeEntry(id, user.id, entryId);
  return new Response(null, { status: 204 });
});

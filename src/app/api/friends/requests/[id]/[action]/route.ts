import { HttpError, handle, json, requireApiUser } from "@/lib/http";
import { respondToRequest } from "@/services/friends";

type Ctx = { params: Promise<{ id: string; action: string }> };

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id, action } = await params;
  if (action !== "accept" && action !== "decline") throw new HttpError(404, "Not found");
  await respondToRequest(id, user.id, action === "accept");
  return json({ ok: true });
});

import { handle, requireApiUser } from "@/lib/http";
import { removeFriend } from "@/services/friends";

type Ctx = { params: Promise<{ userId: string }> };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { userId } = await params;
  await removeFriend(user.id, userId);
  return new Response(null, { status: 204 });
});

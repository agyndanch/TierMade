import type { NextRequest } from "next/server";
import { handle, json, requireApiUser } from "@/lib/http";
import { searchUsersByUsername } from "@/repositories/users";

export const GET = handle(async (req: NextRequest) => {
  const user = await requireApiUser();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return json({ users: [] });
  return json({ users: await searchUsersByUsername(q.slice(0, 32), user.id) });
});

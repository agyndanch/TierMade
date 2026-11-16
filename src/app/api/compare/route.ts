import type { NextRequest } from "next/server";
import { handle, json, requireApiUser } from "@/lib/http";
import { compareQuerySchema } from "@/lib/validation";
import { compareListsForViewer } from "@/services/compare";

export const GET = handle(async (req: NextRequest) => {
  const user = await requireApiUser();
  const { a, b } = compareQuerySchema.parse({
    a: req.nextUrl.searchParams.get("a"),
    b: req.nextUrl.searchParams.get("b"),
  });
  return json(await compareListsForViewer(a, b, user.id));
});

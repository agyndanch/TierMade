import type { NextRequest } from "next/server";
import { getAdapter } from "@/catalog/registry";
import { handle, json, requireApiUser } from "@/lib/http";
import { searchQuerySchema } from "@/lib/validation";

export const GET = handle(async (req: NextRequest) => {
  await requireApiUser();
  const { category, q } = searchQuerySchema.parse({
    category: req.nextUrl.searchParams.get("category"),
    q: req.nextUrl.searchParams.get("q"),
  });
  const results = await getAdapter(category).search(q, 20);
  return json({ results });
});

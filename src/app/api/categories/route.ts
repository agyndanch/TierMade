import { CATEGORIES, CATEGORY_IDS } from "@/catalog/categories";
import { json } from "@/lib/http";

export function GET() {
  return json({ categories: CATEGORY_IDS.map((id) => CATEGORIES[id]) });
}

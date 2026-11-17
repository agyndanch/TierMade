import { BookOpen, Clapperboard, Disc3, Gamepad2, Music, Shapes, Sparkles, Tv } from "lucide-react";
import type { CategoryId } from "./categories";

/** One icon per category (New list form, source chips in "Anything" lists). */
export const CATEGORY_ICONS: Record<CategoryId, typeof Disc3> = {
  albums: Disc3,
  songs: Music,
  games: Gamepad2,
  films: Clapperboard,
  tv: Tv,
  anime: Sparkles,
  manga: BookOpen,
  anything: Shapes,
};

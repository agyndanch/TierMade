import type { EntryWithItem } from "@/repositories/entries";

export type EntryLabels = { displayTitle: string | null; displaySubtitle: string | null };

/** The entry with new custom names applied (null = back to the catalog's). Client-safe. */
export function applyLabels(entry: EntryWithItem, labels: EntryLabels): EntryWithItem {
  return {
    ...entry,
    customTitle: labels.displayTitle,
    customSubtitle: labels.displaySubtitle,
    item: {
      ...entry.item,
      title: labels.displayTitle ?? entry.item.originalTitle,
      subtitle: labels.displaySubtitle ?? entry.item.originalSubtitle,
    },
  };
}

/** Tooltip text: "P5R (Persona 5 Royal) · Atlus · 2019". */
export function entryTooltip(item: EntryWithItem["item"]): string {
  const renamed = item.originalTitle && item.title !== item.originalTitle ? ` (${item.originalTitle})` : "";
  return [`${item.title}${renamed}`, item.subtitle, item.year].filter(Boolean).join(" · ");
}

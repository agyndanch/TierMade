import { describe, expect, it } from "vitest";
import type { EntryWithItem } from "@/repositories/entries";
import { applyLabels, entryTooltip } from "@/lib/entry-labels";

const entry: EntryWithItem = {
  id: "e1",
  tierId: null,
  position: 0,
  unranked: false,
  customTitle: null,
  customSubtitle: null,
  item: {
    id: "i1",
    externalId: "x",
    title: "Persona 5 Royal",
    subtitle: "Atlus",
    originalTitle: "Persona 5 Royal",
    originalSubtitle: "Atlus",
    year: 2019,
    imageUrl: null,
  },
};

describe("applyLabels", () => {
  it("shows custom names and falls back to the originals", () => {
    const renamed = applyLabels(entry, { displayTitle: "P5R", displaySubtitle: null });
    expect(renamed.item).toMatchObject({ title: "P5R", subtitle: "Atlus", originalTitle: "Persona 5 Royal" });
    expect(renamed.customTitle).toBe("P5R");
    const back = applyLabels(renamed, { displayTitle: null, displaySubtitle: null });
    expect(back.item.title).toBe("Persona 5 Royal");
    expect(back.customTitle).toBeNull();
  });

  it("mentions the original name in tooltips when renamed", () => {
    expect(entryTooltip(entry.item)).toBe("Persona 5 Royal · Atlus · 2019");
    expect(entryTooltip(applyLabels(entry, { displayTitle: "P5R", displaySubtitle: null }).item)).toBe(
      "P5R (Persona 5 Royal) · Atlus · 2019",
    );
  });
});

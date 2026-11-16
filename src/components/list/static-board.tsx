import type { ListTier } from "@/db/schema";
import type { EntryWithItem } from "@/repositories/entries";
import { DEFAULT_DISPLAY, type ListDisplay } from "@/lib/list-display";
import { GridTile, RankedRow, TierLabel, TierTile } from "./entry-views";
import { RankedGrid } from "./ranked-grid";

/** Read-only rendering of a ranked list or tier list. */
export function StaticBoard({
  format,
  tiers,
  entries,
  aspect,
  display = DEFAULT_DISPLAY,
}: {
  format: "ranked" | "tier";
  tiers: ListTier[];
  entries: EntryWithItem[];
  aspect: "square" | "portrait";
  display?: ListDisplay;
}) {
  if (entries.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">Nothing here yet.</p>;
  }
  if (format === "ranked" && display.view === "grid") {
    const hidden = entries.length - display.gridColumns * display.gridRows;
    return (
      <div className="space-y-2">
        <RankedGrid
          entries={entries}
          display={display}
          aspect={aspect}
          renderTile={(e) => <GridTile entry={e} aspect={aspect} />}
        />
        {hidden > 0 && (
          <p className="text-sm text-muted">
            {hidden} more {hidden === 1 ? "item isn't" : "items aren't"} shown in the grid.
          </p>
        )}
      </div>
    );
  }
  if (format === "ranked") {
    return (
      <ol className="space-y-2">
        {entries.map((e, i) => (
          <li key={e.id}>
            <RankedRow entry={e} rank={i + 1} aspect={aspect} />
          </li>
        ))}
      </ol>
    );
  }
  const unsorted = entries.filter((e) => !e.tierId);
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {tiers.map((t) => {
          const inTier = entries.filter((e) => e.tierId === t.id);
          return (
            <div key={t.id} className="flex min-h-24 border-b border-border last:border-b-0">
              <TierLabel label={t.label} color={t.color} />
              <div className="flex flex-1 flex-wrap gap-2 p-2">
                {inTier.map((e) => (
                  <TierTile key={e.id} entry={e} aspect={aspect} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {unsorted.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Not ranked yet</p>
          <div className="flex flex-wrap gap-2">
            {unsorted.map((e) => (
              <TierTile key={e.id} entry={e} aspect={aspect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

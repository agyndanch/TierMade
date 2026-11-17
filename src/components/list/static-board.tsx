import type { ListTier } from "@/db/schema";
import type { EntryWithItem } from "@/repositories/entries";
import { DEFAULT_DISPLAY, type ListDisplay } from "@/lib/list-display";
import { fromEntries } from "@/lib/ranked-slots";
import { GridTile, RankedRow, TierLabel, TierTile } from "./entry-views";
import { EmptySlot, RankedGrid } from "./ranked-grid";
import { SaveImageButton } from "./save-image-button";

/** Read-only rendering of a ranked list or tier list. */
export function StaticBoard({
  format,
  tiers,
  entries,
  aspect,
  display = DEFAULT_DISPLAY,
  title,
}: {
  format: "ranked" | "tier";
  tiers: ListTier[];
  entries: EntryWithItem[];
  aspect: "square" | "portrait";
  display?: ListDisplay;
  /** the list's title, for "Save as image" */
  title?: string;
}) {
  if (entries.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">Nothing here yet.</p>;
  }
  if (format === "ranked") {
    const { slots, pool } = fromEntries(entries);
    const capacity = display.gridColumns * display.gridRows;
    const past = slots.flatMap((e, i) => (e && i >= capacity ? [{ e, i }] : []));
    return (
      <div className="space-y-4">
        {display.view === "grid" ? (
          <>
            {title && (
              <div className="-mb-2 flex justify-end">
                <SaveImageButton title={title} slots={slots} display={display} aspect={aspect} />
              </div>
            )}
            <RankedGrid
              slots={slots}
              display={display}
              renderCell={(e, slot) =>
                e ? <GridTile entry={e} aspect={aspect} /> : <EmptySlot aspect={aspect} rank={slot + 1} />
              }
            />
            {past.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted">Ranked past the grid</p>
                <ol className="space-y-1.5">
                  {past.map(({ e, i }) => (
                    <li key={e.id}>
                      <RankedRow entry={e} rank={i + 1} aspect={aspect} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          slots.length > 0 && (
            <ol className="space-y-1.5">
              {slots.map((e, i) => (
                <li key={e?.id ?? `empty-${i}`}>
                  {e ? (
                    <RankedRow entry={e} rank={i + 1} aspect={aspect} />
                  ) : (
                    <div className="flex h-8 items-center gap-3 rounded-lg border border-dashed border-border px-2 text-sm text-muted">
                      <span className="w-7 text-center font-semibold tabular-nums">{i + 1}</span>
                      <span className="text-xs">Empty</span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )
        )}
        {pool.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Not ranked yet</p>
            <div className="flex flex-wrap gap-2">
              {pool.map((e) => (
                <TierTile key={e.id} entry={e} aspect={aspect} />
              ))}
            </div>
          </div>
        )}
      </div>
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

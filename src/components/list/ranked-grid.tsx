import { Fragment, type ReactNode } from "react";
import type { EntryWithItem } from "@/repositories/entries";
import type { ListDisplay } from "@/lib/list-display";
import { cn } from "@/lib/utils";

type Aspect = "square" | "portrait";

/**
 * A ranked list laid out as a cover grid (columns × rows), with the titles of
 * each row's items listed beside it, numbered or not. Entries beyond the grid's
 * capacity are not rendered here; callers decide how to show the overflow.
 */
export function RankedGrid({
  entries,
  display,
  aspect,
  renderTile,
}: {
  entries: EntryWithItem[];
  display: Pick<ListDisplay, "gridColumns" | "gridRows" | "showNumbers">;
  aspect: Aspect;
  renderTile: (entry: EntryWithItem, index: number) => ReactNode;
}) {
  const { gridColumns: cols, gridRows: rows, showNumbers } = display;
  const shown = entries.slice(0, cols * rows);

  return (
    <div className="rounded-xl border border-border bg-surface p-2 sm:p-3" aria-label="Ranked grid">
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: rows }, (_, r) => {
          const start = r * cols;
          const rowEntries = shown.slice(start, start + cols);
          return (
            <div key={r} className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,13rem)]">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {Array.from({ length: cols }, (_, c) => {
                  const entry = rowEntries[c];
                  return entry ? (
                    <Fragment key={entry.id}>{renderTile(entry, start + c)}</Fragment>
                  ) : (
                    <EmptySlot key={`empty-${start + c}`} aspect={aspect} />
                  );
                })}
              </div>
              {rowEntries.length > 0 && (
                <ol className="min-w-0 self-start pb-1 text-xs leading-[1.15rem] sm:pb-0" aria-label={`Row ${r + 1} titles`}>
                  {rowEntries.map((e, i) => (
                    <li key={e.id} className="truncate">
                      {showNumbers && <span className="mr-1 tabular-nums text-muted">{start + i + 1}.</span>}
                      <span className="font-medium">{e.item.title}</span>
                      {e.item.subtitle && <span className="text-muted"> · {e.item.subtitle}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptySlot({ aspect }: { aspect: Aspect }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-md border border-dashed border-border bg-surface-2/50",
        aspect === "square" ? "aspect-square" : "aspect-[2/3]",
      )}
    />
  );
}

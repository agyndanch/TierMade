import { Fragment, type ReactNode } from "react";
import type { EntryWithItem } from "@/repositories/entries";
import { labelFor, labelsShown, type ListDisplay } from "@/lib/list-display";
import { cn } from "@/lib/utils";

type Aspect = "square" | "portrait";

/**
 * A ranked list's slots laid out as a cover grid (columns × rows), with the
 * titles of each row's items listed beside it, numbered by their real rank or
 * not. Slots can be empty. Ranks past the grid's capacity aren't rendered here.
 */
export function RankedGrid({
  slots,
  display,
  renderCell,
}: {
  /** index = slot (rank − 1); null = empty */
  slots: (EntryWithItem | null)[];
  display: Pick<ListDisplay, "gridColumns" | "gridRows" | "showNumbers" | "showTitles" | "showCreators">;
  /** renders one cell: a cover, or an empty slot */
  renderCell: (entry: EntryWithItem | null, slot: number) => ReactNode;
}) {
  const { gridColumns: cols, gridRows: rows } = display;
  const withText = labelsShown(display);

  return (
    <div className="rounded-xl border border-border bg-surface p-2 sm:p-3" aria-label="Ranked grid">
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: rows }, (_, r) => {
          const start = r * cols;
          const cells = Array.from({ length: cols }, (_, c) => slots[start + c] ?? null);
          const titled = cells.flatMap((e, c) => (e ? [{ e, rank: start + c + 1 }] : []));
          return (
            <div
              key={r}
              className={cn("grid gap-x-4 gap-y-1", withText && "sm:grid-cols-[minmax(0,1fr)_minmax(8rem,13rem)]")}
            >
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {cells.map((e, c) => (
                  <Fragment key={e?.id ?? `empty-${start + c}`}>{renderCell(e, start + c)}</Fragment>
                ))}
              </div>
              {withText && titled.length > 0 && (
                <ol className="min-w-0 self-start pb-1 text-xs leading-[1.15rem] sm:pb-0" aria-label={`Row ${r + 1} titles`}>
                  {titled.map(({ e, rank }) => {
                    const label = labelFor(display, rank, e.item)!;
                    return (
                      <li key={e.id} className="truncate">
                        {label.number && <span className="mr-1 tabular-nums text-muted">{label.number}</span>}
                        {label.title && <span className="font-medium">{label.title}</span>}
                        {label.creator && (
                          <span className={label.title ? "text-muted" : "font-medium"}>
                            {label.title ? " · " : ""}
                            {label.creator}
                          </span>
                        )}
                        {!label.title && !label.creator && <span className="text-muted">—</span>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Placeholder for an empty slot (also the drop-target look in the editor). */
export function EmptySlot({
  aspect,
  rank,
  highlight,
  className,
}: {
  aspect: Aspect;
  rank?: number;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-label={rank ? `Empty slot #${rank}` : undefined}
      className={cn(
        "flex items-center justify-center rounded-md border border-dashed border-border bg-surface-2/50 text-[10px] tabular-nums text-muted/60 transition-colors",
        aspect === "square" ? "aspect-square" : "aspect-[2/3]",
        highlight && "border-accent bg-accent-soft text-accent",
        className,
      )}
    >
      {rank}
    </div>
  );
}

"use client";

import { LayoutGrid, List as ListIcon, Minus, Plus, Rows3 } from "lucide-react";
import { GRID_MAX, GRID_MIN, clampGrid, type ListDisplay } from "@/lib/list-display";
import { cn } from "@/lib/utils";

/** List/grid switch, grid size and numbering options, and "remove gaps" for a ranked list. */
export function DisplayControls({
  display,
  onChange,
  filledSpots,
  hasGaps,
  onRemoveGaps,
}: {
  display: ListDisplay;
  onChange: (next: ListDisplay) => void;
  /** grid spots that hold an item */
  filledSpots: number;
  hasGaps: boolean;
  onRemoveGaps: () => void;
}) {
  const set = (patch: Partial<ListDisplay>) => onChange({ ...display, ...patch });
  const isGrid = display.view === "grid";
  const capacity = display.gridColumns * display.gridRows;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2" role="toolbar" aria-label="Display options">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
        {(
          [
            ["list", "List", ListIcon],
            ["grid", "Grid", LayoutGrid],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={display.view === value}
            onClick={() => set({ view: value })}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium",
              display.view === value ? "bg-surface shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {isGrid && (
        <>
          <Stepper label="Columns" value={display.gridColumns} onChange={(n) => set({ gridColumns: n })} />
          <Stepper label="Rows" value={display.gridRows} onChange={(n) => set({ gridRows: n })} />
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={display.showNumbers}
              onChange={(e) => set({ showNumbers: e.target.checked })}
              className="size-4 accent-accent"
            />
            Numbers
          </label>
          <span className="text-xs text-muted">
            {filledSpots} of {capacity} spots filled
          </span>
        </>
      )}
      {hasGaps && (
        <button
          type="button"
          onClick={onRemoveGaps}
          title="Move everything up so the ranks have no empty slots"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <Rows3 className="size-3.5" /> Remove gaps
        </button>
      )}
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const btn =
    "flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="inline-flex items-center gap-2 text-sm" role="group" aria-label={label}>
      <span className="text-muted">{label}</span>
      <div className="inline-flex items-center rounded-lg bg-surface-2 p-0.5">
        <button
          type="button"
          className={btn}
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= GRID_MIN}
          onClick={() => onChange(clampGrid(value - 1))}
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-6 text-center font-medium tabular-nums" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className={btn}
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= GRID_MAX}
          onClick={() => onChange(clampGrid(value + 1))}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

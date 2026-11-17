"use client";

import type { ReactNode } from "react";
import { LayoutGrid, List as ListIcon, Minus, Plus, Rows3 } from "lucide-react";
import { GRID_MAX, GRID_MIN, clampGrid, labelsShown, type ListDisplay } from "@/lib/list-display";
import { cn } from "@/lib/utils";

/**
 * The bar above a ranked list: the List/Grid switch plus actions (remove gaps,
 * save as image). Settings live in the side panel's Customize tab.
 */
export function ViewBar({
  display,
  onChange,
  filledSpots,
  hasGaps,
  onRemoveGaps,
  saveImage,
}: {
  display: ListDisplay;
  onChange: (next: ListDisplay) => void;
  /** grid spots that hold an item */
  filledSpots: number;
  hasGaps: boolean;
  onRemoveGaps: () => void;
  /** grid view: the "Save as image" button */
  saveImage?: ReactNode;
}) {
  const isGrid = display.view === "grid";
  const capacity = display.gridColumns * display.gridRows;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2" role="toolbar" aria-label="View">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
        {(
          [
            ["grid", "Grid", LayoutGrid],
            ["list", "List", ListIcon],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={display.view === value}
            onClick={() => onChange({ ...display, view: value })}
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
        <span className="text-xs text-muted">
          {filledSpots} of {capacity} spots filled
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
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
        {isGrid && saveImage}
      </div>
    </div>
  );
}

/** The Customize tab: grid size and what the text beside each row shows. */
export function CustomizePanel({
  display,
  onChange,
  creatorLabel,
}: {
  display: ListDisplay;
  onChange: (next: ListDisplay) => void;
  /** "Artist", "Developer", … */
  creatorLabel: string;
}) {
  const set = (patch: Partial<ListDisplay>) => onChange({ ...display, ...patch });
  const textOn = labelsShown(display);

  return (
    <div className="space-y-5">
      {display.view === "list" && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          These settings shape grid view.{" "}
          <button
            type="button"
            onClick={() => set({ view: "grid" })}
            className="font-medium text-accent hover:underline"
          >
            Switch to grid
          </button>
        </p>
      )}

      <section className="space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Grid size</h3>
        <Stepper label="Columns" value={display.gridColumns} onChange={(n) => set({ gridColumns: n })} />
        <Stepper label="Rows" value={display.gridRows} onChange={(n) => set({ gridRows: n })} />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Beside each row</h3>
        <Toggle
          label="Titles"
          hint="The name of each item"
          checked={display.showTitles}
          onChange={(v) => set({ showTitles: v })}
        />
        <Toggle
          label={`${creatorLabel}s`}
          hint={`Who made it (${creatorLabel.toLowerCase()})`}
          checked={display.showCreators}
          onChange={(v) => set({ showCreators: v })}
        />
        <Toggle
          label="Numbers"
          hint={textOn ? "Rank before each line" : "Turn on titles or creators to number them"}
          checked={display.showNumbers}
          disabled={!textOn}
          onChange={(v) => set({ showNumbers: v })}
        />
        {!textOn && <p className="text-xs text-muted">With no text, the covers fill the full width.</p>}
      </section>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-surface-2",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-accent"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const btn =
    "flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center justify-between gap-2 text-sm" role="group" aria-label={label}>
      <span>{label}</span>
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

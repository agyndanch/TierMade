"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import type { EntryWithItem } from "@/repositories/entries";
import type { ListDisplay } from "@/lib/list-display";
import { allEntries, findEntry, moveToPool, moveToSlot, slotOf, MAX_SLOT, type RankedState } from "@/lib/ranked-slots";
import { cn } from "@/lib/utils";
import { GridTile, RankedRow } from "./entry-views";
import { EmptySlot, RankedGrid } from "./ranked-grid";

type Aspect = "square" | "portrait";
type State = RankedState<EntryWithItem>;

const POOL = "pool";
const slotId = (i: number) => `slot:${i}`;
const parseSlot = (id: UniqueIdentifier) => {
  const m = String(id).match(/^slot:(\d+)$/);
  return m ? Number(m[1]) : null;
};
const dropLabel = (id: UniqueIdentifier) => {
  const s = parseSlot(id);
  return s !== null ? `#${s + 1}` : id === POOL ? "Not ranked yet" : "nowhere";
};

/** Prefer what's under the pointer; fall back to the nearest target (keyboard, edges). */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCenter(args);
};

/** Arrow keys jump to the nearest drop target in that direction. */
const jumpToNearestTarget: KeyboardCoordinateGetter = (event, { context }) => {
  const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[event.code];
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!dir || !collisionRect) return undefined;
  event.preventDefault();
  const cx = collisionRect.left + collisionRect.width / 2;
  const cy = collisionRect.top + collisionRect.height / 2;
  let best: { left: number; top: number; width: number; height: number } | null = null;
  let bestScore = Infinity;
  for (const container of droppableContainers.getEnabled()) {
    const r = droppableRects.get(container.id);
    if (!r) continue;
    const dx = r.left + r.width / 2 - cx;
    const dy = r.top + r.height / 2 - cy;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 2) continue; // not in that direction
    const across = Math.abs(dir[0] ? dy : dx);
    const score = along + across * 3;
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  if (!best) return undefined;
  return {
    x: best.left + (best.width - collisionRect.width) / 2,
    y: best.top + (best.height - collisionRect.height) / 2,
  };
};

/**
 * Owner's editor for a ranked list: numbered slots that can be empty (shown as
 * a list or a cover grid) plus a "Not ranked yet" area. Drops follow the rules
 * in lib/ranked-slots.ts.
 */
export function RankedEditor({
  state,
  display,
  aspect,
  onChange,
  onRemove,
}: {
  state: State;
  display: ListDisplay;
  aspect: Aspect;
  /** a move happened: show it and save it */
  onChange: (next: State) => void;
  onRemove: (entry: EntryWithItem) => void;
}) {
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    // Instant scrolling keeps measured positions in sync when a jump scrolls the page.
    useSensor(KeyboardSensor, { coordinateGetter: jumpToNearestTarget, scrollBehavior: "instant" }),
  );

  const titleOf = (id: UniqueIdentifier) => findEntry(state, String(id))?.item.title ?? "item";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} is over ${dropLabel(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} was dropped on ${dropLabel(over.id)}.` : `${titleOf(active.id)} was put back.`,
    onDragCancel: ({ active }) => `Cancelled. ${titleOf(active.id)} was put back.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const id = String(active.id);
    const slot = parseSlot(over.id);
    if (slot !== null) {
      if (slotOf(state, id) !== slot) onChange(moveToSlot(state, id, slot));
    } else if (over.id === POOL && slotOf(state, id) !== null) {
      onChange(moveToPool(state, id));
    }
  }

  const total = allEntries(state).length;
  const maxRank = Math.min(MAX_SLOT + 1, Math.max(100, total));
  const moveTo = (entry: EntryWithItem) => (rank: number) => onChange(moveToSlot(state, entry.id, rank - 1));
  const active = activeId ? findEntry(state, activeId) : undefined;
  const activeInSlots = activeId ? slotOf(state, activeId) !== null : false;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{ announcements }}
      onDragStart={({ active }: DragStartEvent) => setActiveId(String(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {display.view === "grid" ? (
        <GridSlots state={state} display={display} aspect={aspect} maxRank={maxRank} moveTo={moveTo} onRemove={onRemove} />
      ) : (
        <ListSlots state={state} aspect={aspect} maxRank={maxRank} moveTo={moveTo} onRemove={onRemove} />
      )}

      <Pool state={state} aspect={aspect} maxRank={maxRank} moveTo={moveTo} onRemove={onRemove} />

      <DragOverlay>
        {active ? (
          display.view === "list" && activeInSlots ? (
            <RankedRow entry={active} rank={(slotOf(state, active.id) ?? 0) + 1} aspect={aspect} overlay />
          ) : (
            <GridTile entry={active} aspect={aspect} overlay className="w-full" />
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

type SlotsProps = {
  state: State;
  aspect: Aspect;
  maxRank: number;
  moveTo: (entry: EntryWithItem) => (rank: number) => void;
  onRemove: (entry: EntryWithItem) => void;
};

/* --------------------------------- grid --------------------------------- */

function GridSlots({ state, display, ...rest }: SlotsProps & { display: ListDisplay }) {
  // `rest` deliberately excludes `state`: cells only need the shared callbacks.
  const capacity = display.gridColumns * display.gridRows;
  const past = state.slots.flatMap((e, i) => (e && i >= capacity ? [{ e, i }] : []));
  return (
    <>
      <RankedGrid
        slots={state.slots}
        display={display}
        renderCell={(entry, slot) => <GridCell entry={entry} slot={slot} {...rest} />}
      />
      {past.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-muted">
            Ranked past the grid ({past.length}): drag them in, or make the grid bigger
          </p>
          <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-border p-2">
            {past.map(({ e, i }) => (
              <DraggableTile key={e.id} entry={e} label={`#${i + 1}`} className="w-16 sm:w-[72px]" {...rest} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function GridCell({ entry, slot, ...rest }: Omit<SlotsProps, "state"> & { entry: EntryWithItem | null; slot: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(slot) });
  return (
    <div ref={setNodeRef} className={cn("relative min-w-0 rounded-md", isOver && entry && "ring-2 ring-accent")}>
      {entry ? (
        <DraggableTile entry={entry} label={`#${slot + 1}`} {...rest} />
      ) : (
        <EmptySlot aspect={rest.aspect} rank={slot + 1} highlight={isOver} />
      )}
    </div>
  );
}

/** A draggable cover with a "move to #" control and a remove button. */
function DraggableTile({
  entry,
  label,
  aspect,
  maxRank,
  moveTo,
  onRemove,
  className,
}: Omit<SlotsProps, "state"> & { entry: EntryWithItem; label: string; className?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id });
  return (
    <div className={cn("group relative", className)}>
      <GridTile
        ref={setNodeRef}
        entry={entry}
        aspect={aspect}
        dragging={isDragging}
        onRemove={() => onRemove(entry)}
        className="touch-none cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={`${label === "#" ? "Not ranked yet" : label}: ${entry.item.title}. Press space to pick up, arrow keys to move.`}
      />
      <RankMover
        label={label}
        title={entry.item.title}
        maxRank={maxRank}
        onMove={moveTo(entry)}
        className="absolute bottom-1 left-1 hidden group-focus-within:flex group-hover:flex"
      />
    </div>
  );
}

/* --------------------------------- list --------------------------------- */

function ListSlots({ state, ...rest }: SlotsProps) {
  // Every slot up to the last ranked item, plus one empty slot to drop at the end.
  const count = state.slots.length + 1;
  return (
    <ol className="space-y-1.5" aria-label="Ranked items">
      {Array.from({ length: count }, (_, i) => (
        <ListSlot key={state.slots[i]?.id ?? `empty-${i}`} entry={state.slots[i] ?? null} slot={i} {...rest} />
      ))}
    </ol>
  );
}

function ListSlot({
  entry,
  slot,
  aspect,
  maxRank,
  moveTo,
  onRemove,
}: Omit<SlotsProps, "state"> & { entry: EntryWithItem | null; slot: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(slot) });
  return (
    <li ref={setNodeRef} className={cn("rounded-lg", isOver && entry && "ring-2 ring-accent")}>
      {entry ? (
        <DraggableRow entry={entry} slot={slot} aspect={aspect} maxRank={maxRank} moveTo={moveTo} onRemove={onRemove} />
      ) : (
        <div
          aria-label={`Empty slot #${slot + 1}`}
          className={cn(
            "flex h-9 items-center gap-3 rounded-lg border border-dashed border-border px-2 text-sm text-muted transition-colors",
            isOver && "border-accent bg-accent-soft text-accent",
          )}
        >
          <span className="w-[4.25rem] shrink-0 pr-1 text-right font-semibold tabular-nums">{slot + 1}</span>
          <span className="text-xs">Empty</span>
        </div>
      )}
    </li>
  );
}

function DraggableRow({
  entry,
  slot,
  aspect,
  maxRank,
  moveTo,
  onRemove,
}: Omit<SlotsProps, "state"> & { entry: EntryWithItem; slot: number }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: entry.id });
  return (
    <RankedRow
      ref={setNodeRef}
      entry={entry}
      rank={slot + 1}
      aspect={aspect}
      dragging={isDragging}
      onRemove={() => onRemove(entry)}
      handleProps={{ ...attributes, ...listeners, ref: setActivatorNodeRef } as React.HTMLAttributes<HTMLButtonElement>}
      rankControl={
        <RankMover
          label={String(slot + 1)}
          title={entry.item.title}
          maxRank={maxRank}
          onMove={moveTo(entry)}
          className="w-9 justify-center text-lg font-bold text-muted"
          plain
        />
      }
    />
  );
}

/* --------------------------------- pool --------------------------------- */

function Pool({ state, ...rest }: SlotsProps) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL });
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-medium text-muted">Not ranked yet: drag these into a slot</p>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-wrap content-start gap-2 rounded-xl border border-dashed border-border bg-surface/50 p-2 transition-colors",
          isOver && "border-accent bg-accent-soft/60",
        )}
      >
        {state.pool.map((e) => (
          <DraggableTile key={e.id} entry={e} label="#" className="w-16 sm:w-[72px]" {...rest} />
        ))}
        {state.pool.length === 0 && (
          <p className="self-center px-2 text-sm text-muted">Drop items here to take them out of the ranking.</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ move to # ------------------------------- */

/** Shows the rank; click it to type a new one ("move to #10"). */
function RankMover({
  label,
  title,
  maxRank,
  onMove,
  className,
  plain,
}: {
  label: string;
  title: string;
  maxRank: number;
  onMove: (rank: number) => void;
  className?: string;
  /** render as bare text (list rows) instead of a small chip (tiles) */
  plain?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  function commit(value: string) {
    setEditing(false);
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= maxRank) onMove(n);
  }

  if (editing) {
    return (
      <input
        ref={input}
        type="number"
        min={1}
        max={maxRank}
        defaultValue={label === "#" ? "" : label.replace("#", "")}
        aria-label={`Move ${title} to rank`}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit(e.currentTarget.value);
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={(e) => commit(e.currentTarget.value)}
        className={cn(
          "z-10 h-7 w-14 rounded-md border border-accent bg-surface px-1 text-center text-sm tabular-nums text-foreground outline-none",
          className?.includes("absolute") && "absolute bottom-1 left-1",
        )}
      />
    );
  }
  return (
    <button
      type="button"
      title="Move to a rank"
      aria-label={`Move ${title} to a rank (now ${label === "#" ? "not ranked" : label})`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => setEditing(true)}
      className={cn(
        "items-center tabular-nums",
        plain
          ? "flex shrink-0 rounded py-0.5 hover:bg-surface-2 hover:text-foreground"
          : "rounded-full bg-foreground/85 px-1.5 py-0.5 text-[10px] font-semibold text-background shadow",
        className,
      )}
    >
      {label}
    </button>
  );
}

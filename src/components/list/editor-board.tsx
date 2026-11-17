"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ListTier } from "@/db/schema";
import type { EntryWithItem } from "@/repositories/entries";
import { cn } from "@/lib/utils";
import { tierCollision, tierKeyboardCoordinates } from "@/lib/tier-collision";
import { TierLabel, TierTile } from "./entry-views";

/** Tier lists' unsorted pool. (Ranked lists use ranked-editor.tsx.) */
export const UNSORTED = "unsorted";

/** containerId → entries in order. Container ids are tier ids or "unsorted". */
export type Containers = Record<string, EntryWithItem[]>;

export function toContainers(tiers: ListTier[], entries: EntryWithItem[]): Containers {
  const c: Containers = Object.fromEntries(tiers.map((t) => [t.id, [] as EntryWithItem[]]));
  c[UNSORTED] = [];
  for (const e of entries) (e.tierId && c[e.tierId] ? c[e.tierId] : c[UNSORTED]).push(e);
  return c;
}

export function toOrderPayload(containers: Containers) {
  return Object.entries(containers).flatMap(([cid, list]) =>
    list.map((e, position) => ({
      id: e.id,
      tierId: cid === UNSORTED ? null : cid,
      position,
      unranked: false,
    })),
  );
}

function findContainer(containers: Containers, id: UniqueIdentifier): string | undefined {
  const key = String(id);
  if (key in containers) return key;
  return Object.keys(containers).find((cid) => containers[cid].some((e) => e.id === key));
}

/** Owner's tier-list editor: drag covers between tiers and the unsorted pool. */
export function TierBoard({
  tiers,
  aspect,
  containers,
  onChange,
  onCommit,
  onRemove,
  onEdit,
}: {
  tiers: ListTier[];
  aspect: "square" | "portrait";
  containers: Containers;
  /** live updates while dragging */
  onChange: (next: Containers) => void;
  /** drag finished: persist this order */
  onCommit: (next: Containers) => void;
  onRemove: (entry: EntryWithItem) => void;
  /** open the item editor (rename in this list) */
  onEdit: (entry: EntryWithItem) => void;
}) {
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  // A drag can end with a click on the same cover; don't treat that as "edit".
  const lastDragEnd = useRef(0);
  const edit = (entry: EntryWithItem) => {
    if (Date.now() - lastDragEnd.current > 250) onEdit(entry);
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: tierKeyboardCoordinates([...tiers.map((t) => t.id), UNSORTED]),
      // Instant scrolling keeps measured positions in sync when a jump scrolls the page.
      scrollBehavior: "instant",
    }),
  );

  const activeEntry = activeId
    ? Object.values(containers)
        .flat()
        .find((e) => e.id === activeId)
    : undefined;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  // Moving between containers happens live so the drop preview is accurate.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findContainer(containers, active.id);
    const to = findContainer(containers, over.id);
    if (!from || !to || from === to) return;
    const fromItems = containers[from];
    const toItems = containers[to];
    const moving = fromItems.find((e) => e.id === active.id);
    if (!moving) return;
    const overIndex = toItems.findIndex((e) => e.id === over.id);
    const insertAt = overIndex >= 0 ? overIndex : toItems.length;
    onChange({
      ...containers,
      [from]: fromItems.filter((e) => e.id !== active.id),
      [to]: [...toItems.slice(0, insertAt), moving, ...toItems.slice(insertAt)],
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    lastDragEnd.current = Date.now();
    let next = containers;
    if (over) {
      const from = findContainer(containers, active.id);
      const to = findContainer(containers, over.id);
      if (from && to && from === to) {
        const items = containers[from];
        const oldIndex = items.findIndex((e) => e.id === active.id);
        // Over a cover: take its place. Over the tier itself (empty space past the last cover): go to the end.
        const newIndex = String(over.id) === to ? items.length - 1 : items.findIndex((e) => e.id === over.id);
        if (oldIndex !== newIndex && newIndex >= 0) {
          next = { ...containers, [from]: arrayMove(items, oldIndex, newIndex) };
          onChange(next);
        }
      }
    }
    onCommit(next);
  }

  // Which covers live in which tier, for the pointer-based collision detection.
  const collision = useMemo(
    () => tierCollision(Object.fromEntries(Object.entries(containers).map(([cid, list]) => [cid, list.map((e) => e.id)]))),
    [containers],
  );

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        lastDragEnd.current = Date.now();
      }}
    >
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {tiers.map((t) => (
          <TierRow
            key={t.id}
            tier={t}
            entries={containers[t.id] ?? []}
            aspect={aspect}
            onRemove={onRemove}
            onEdit={edit}
          />
        ))}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-muted">Not ranked yet: drag these into a tier</p>
        <UnsortedZone entries={containers[UNSORTED] ?? []} aspect={aspect} onRemove={onRemove} onEdit={edit} />
      </div>
      <DragOverlay>{activeEntry ? <TierTile entry={activeEntry} aspect={aspect} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

type ZoneProps = {
  entries: EntryWithItem[];
  aspect: "square" | "portrait";
  onRemove: (e: EntryWithItem) => void;
  onEdit: (e: EntryWithItem) => void;
};

/** One tier: the whole row, label included, is the drop target. */
function TierRow({ tier, ...rest }: ZoneProps & { tier: ListTier }) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-24 border-b border-border transition-colors last:border-b-0 sm:min-h-28",
        isOver && "bg-accent-soft/60",
      )}
    >
      <TierLabel label={tier.label} color={tier.color} />
      <TileArea id={tier.id} {...rest} />
    </div>
  );
}

function UnsortedZone(props: ZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSORTED });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border border-dashed border-border bg-surface/50 transition-colors",
        isOver && "border-accent bg-accent-soft/60",
      )}
    >
      <TileArea id={UNSORTED} emptyText="New items land here." {...props} />
    </div>
  );
}

/** The sortable covers inside a tier or the unsorted pool (the drop target is the parent). */
function TileArea({ id, entries, aspect, onRemove, onEdit, emptyText }: ZoneProps & { id: string; emptyText?: string }) {
  return (
    <SortableContext id={id} items={entries.map((e) => e.id)} strategy={rectSortingStrategy}>
      <div className="flex min-h-24 flex-1 flex-wrap content-start gap-2 p-2">
        {entries.map((e) => (
          <SortableTierTile
            key={e.id}
            entry={e}
            aspect={aspect}
            onRemove={() => onRemove(e)}
            onEdit={() => onEdit(e)}
          />
        ))}
        {entries.length === 0 && emptyText && <p className="self-center px-2 text-sm text-muted">{emptyText}</p>}
      </div>
    </SortableContext>
  );
}

function SortableTierTile({
  entry,
  aspect,
  onRemove,
  onEdit,
}: {
  entry: EntryWithItem;
  aspect: "square" | "portrait";
  onRemove: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  return (
    <TierTile
      ref={setNodeRef}
      entry={entry}
      aspect={aspect}
      dragging={isDragging}
      onRemove={onRemove}
      onEdit={onEdit}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="touch-none cursor-grab active:cursor-grabbing"
      aria-label={`${entry.item.title}. Press space to pick up, arrow keys to move.`}
      {...attributes}
      {...listeners}
    />
  );
}

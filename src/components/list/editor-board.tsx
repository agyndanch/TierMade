"use client";

import { useId, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ListTier } from "@/db/schema";
import type { EntryWithItem } from "@/repositories/entries";
import { cn } from "@/lib/utils";
import { RankedRow, TierLabel, TierTile } from "./entry-views";

export const RANKED = "ranked";
export const UNSORTED = "unsorted";

/** containerId → entries in order. Container ids are tier ids, "ranked" or "unsorted". */
export type Containers = Record<string, EntryWithItem[]>;

export function toContainers(format: "ranked" | "tier", tiers: ListTier[], entries: EntryWithItem[]): Containers {
  if (format === "ranked") return { [RANKED]: entries };
  const c: Containers = Object.fromEntries(tiers.map((t) => [t.id, [] as EntryWithItem[]]));
  c[UNSORTED] = [];
  for (const e of entries) (e.tierId && c[e.tierId] ? c[e.tierId] : c[UNSORTED]).push(e);
  return c;
}

export function toOrderPayload(containers: Containers) {
  return Object.entries(containers).flatMap(([cid, list]) =>
    list.map((e, position) => ({
      id: e.id,
      tierId: cid === RANKED || cid === UNSORTED ? null : cid,
      position,
    })),
  );
}

function findContainer(containers: Containers, id: UniqueIdentifier): string | undefined {
  const key = String(id);
  if (key in containers) return key;
  return Object.keys(containers).find((cid) => containers[cid].some((e) => e.id === key));
}

export function EditorBoard({
  format,
  tiers,
  aspect,
  containers,
  onChange,
  onCommit,
  onRemove,
}: {
  format: "ranked" | "tier";
  tiers: ListTier[];
  aspect: "square" | "portrait";
  containers: Containers;
  /** live updates while dragging */
  onChange: (next: Containers) => void;
  /** drag finished: persist this order */
  onCommit: (next: Containers) => void;
  onRemove: (entry: EntryWithItem) => void;
}) {
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
    let next = containers;
    if (over) {
      const from = findContainer(containers, active.id);
      const to = findContainer(containers, over.id);
      if (from && to && from === to) {
        const items = containers[from];
        const oldIndex = items.findIndex((e) => e.id === active.id);
        const newIndex = items.findIndex((e) => e.id === over.id);
        if (oldIndex !== newIndex && newIndex >= 0) {
          next = { ...containers, [from]: arrayMove(items, oldIndex, newIndex) };
          onChange(next);
        }
      }
    }
    onCommit(next);
  }

  const dnd = {
    id: dndId,
    sensors,
    collisionDetection: closestCorners,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragEnd: handleDragEnd,
    onDragCancel: () => setActiveId(null),
  };

  if (format === "ranked") {
    const items = containers[RANKED] ?? [];
    return (
      <DndContext {...dnd}>
        <SortableContext items={items.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2" aria-label="Ranked items">
            {items.map((e, i) => (
              <SortableRankedRow key={e.id} entry={e} rank={i + 1} aspect={aspect} onRemove={() => onRemove(e)} />
            ))}
          </ol>
        </SortableContext>
        <DragOverlay>
          {activeEntry ? (
            <RankedRow
              entry={activeEntry}
              rank={items.findIndex((e) => e.id === activeEntry.id) + 1}
              aspect={aspect}
              overlay
              handleProps={{}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  return (
    <DndContext {...dnd}>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {tiers.map((t) => (
          <div key={t.id} className="flex min-h-24 border-b border-border last:border-b-0 sm:min-h-28">
            <TierLabel label={t.label} color={t.color} />
            <TierDropZone id={t.id} entries={containers[t.id] ?? []} aspect={aspect} onRemove={onRemove} />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-muted">Not ranked yet: drag these into a tier</p>
        <div className="rounded-xl border border-dashed border-border bg-surface/50">
          <TierDropZone
            id={UNSORTED}
            entries={containers[UNSORTED] ?? []}
            aspect={aspect}
            onRemove={onRemove}
            emptyText="New items land here."
          />
        </div>
      </div>
      <DragOverlay>{activeEntry ? <TierTile entry={activeEntry} aspect={aspect} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function TierDropZone({
  id,
  entries,
  aspect,
  onRemove,
  emptyText,
}: {
  id: string;
  entries: EntryWithItem[];
  aspect: "square" | "portrait";
  onRemove: (e: EntryWithItem) => void;
  emptyText?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SortableContext id={id} items={entries.map((e) => e.id)} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn("flex min-h-24 flex-1 flex-wrap content-start gap-2 p-2 transition-colors", isOver && "bg-accent-soft/60")}
      >
        {entries.map((e) => (
          <SortableTierTile key={e.id} entry={e} aspect={aspect} onRemove={() => onRemove(e)} />
        ))}
        {entries.length === 0 && emptyText && <p className="self-center px-2 text-sm text-muted">{emptyText}</p>}
      </div>
    </SortableContext>
  );
}

function SortableRankedRow({
  entry,
  rank,
  aspect,
  onRemove,
}: {
  entry: EntryWithItem;
  rank: number;
  aspect: "square" | "portrait";
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <RankedRow
        entry={entry}
        rank={rank}
        aspect={aspect}
        dragging={isDragging}
        onRemove={onRemove}
        handleProps={{ ...attributes, ...listeners, ref: setActivatorNodeRef } as React.HTMLAttributes<HTMLButtonElement>}
      />
    </li>
  );
}

function SortableTierTile({
  entry,
  aspect,
  onRemove,
}: {
  entry: EntryWithItem;
  aspect: "square" | "portrait";
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  return (
    <TierTile
      ref={setNodeRef}
      entry={entry}
      aspect={aspect}
      dragging={isDragging}
      onRemove={onRemove}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="touch-none cursor-grab active:cursor-grabbing"
      aria-label={`${entry.item.title}. Press space to pick up, arrow keys to move.`}
      {...attributes}
      {...listeners}
    />
  );
}

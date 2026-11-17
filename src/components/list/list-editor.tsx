"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CatalogCategoryId, CategoryInfo } from "@/catalog/categories";
import type { CatalogResult } from "@/catalog/types";
import type { ListTier } from "@/db/schema";
import type { EntryWithItem } from "@/repositories/entries";
import type { ListDisplay } from "@/lib/list-display";
import * as slots from "@/lib/ranked-slots";
import { SlidersHorizontal } from "lucide-react";
import { api, cn } from "@/lib/utils";
import { applyLabels, type EntryLabels } from "@/lib/entry-labels";
import { CustomizePanel, ViewBar } from "./display-controls";
import { ItemEditDialog } from "./item-edit-dialog";
import { SaveImageButton } from "./save-image-button";
import { TierBoard, UNSORTED, toContainers, toOrderPayload, type Containers } from "./editor-board";
import { RankedEditor } from "./ranked-editor";
import { SearchPanel, resultKey } from "./search-panel";

type RankedState = slots.RankedState<EntryWithItem>;
type OrderPayload = { id: string; tierId: string | null; position: number; unranked: boolean }[];

export function ListEditor({
  listId,
  listTitle,
  format,
  tiers,
  initialEntries,
  initialDisplay,
  category,
}: {
  listId: string;
  /** used to name a saved image */
  listTitle: string;
  format: "ranked" | "tier";
  tiers: ListTier[];
  initialEntries: EntryWithItem[];
  initialDisplay: ListDisplay;
  category: CategoryInfo;
}) {
  const router = useRouter();
  // Tier lists: entries per tier. Ranked lists: numbered slots + "Not ranked yet".
  const [containers, setContainers] = useState<Containers>(() => toContainers(tiers, format === "tier" ? initialEntries : []));
  const [ranked, setRanked] = useState<RankedState>(() => slots.fromEntries(format === "ranked" ? initialEntries : []));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const payloadNow = (c: Containers, r: RankedState): OrderPayload =>
    format === "ranked" ? slots.toOrderPayload(r) : toOrderPayload(c);
  const lastSaved = useRef(JSON.stringify(payloadNow(containers, ranked)));
  const [display, setDisplay] = useState(initialDisplay);
  const savedDisplay = useRef(initialDisplay);
  const [panel, setPanel] = useState<"add" | "customize">("add");
  const [editing, setEditing] = useState<EntryWithItem | null>(null);

  // Save display changes after the clicking stops, sending only what changed.
  useEffect(() => {
    const patch = Object.fromEntries(
      (Object.keys(display) as (keyof ListDisplay)[])
        .filter((k) => display[k] !== savedDisplay.current[k])
        .map((k) => [k, display[k]]),
    );
    if (Object.keys(patch).length === 0) return;
    const timer = setTimeout(async () => {
      try {
        await api(`/api/lists/${listId}`, { method: "PATCH", json: patch });
        savedDisplay.current = display;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save the display settings");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [display, listId]);

  const allEntries = useMemo(
    () => (format === "ranked" ? slots.allEntries(ranked) : Object.values(containers).flat()),
    [format, ranked, containers],
  );
  const added = useMemo(
    () => new Set(allEntries.map((e) => resultKey(e.item.category, e.item.externalId))),
    [allEntries],
  );

  /** Show a newly created entry where the server put it. */
  function showNewEntry(entry: EntryWithItem) {
    if (format === "ranked") {
      setRanked((r) => {
        const next = slots.insertNew(r, entry);
        lastSaved.current = JSON.stringify(slots.toOrderPayload(next));
        return next;
      });
      toast.success(entry.unranked ? `Added ${entry.item.title} to Not ranked yet` : `Added ${entry.item.title}`, {
        duration: 1500,
      });
    } else {
      setContainers((c) => {
        const next = { ...c, [UNSORTED]: [...c[UNSORTED], entry] };
        lastSaved.current = JSON.stringify(toOrderPayload(next));
        return next;
      });
      toast.success(`Added ${entry.item.title}`, { duration: 1500 });
    }
  }

  async function addCustom(form: FormData): Promise<boolean> {
    try {
      const { entry } = await api<{ entry: EntryWithItem }>(`/api/lists/${listId}/custom-entries`, {
        method: "POST",
        body: form,
      });
      showNewEntry(entry);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add that");
      return false;
    }
  }

  async function addItem(r: CatalogResult, source: CatalogCategoryId) {
    const key = resultKey(source, r.externalId);
    setPending((p) => new Set(p).add(key));
    try {
      const { entry } = await api<{ entry: EntryWithItem }>(`/api/lists/${listId}/entries`, {
        method: "POST",
        // "anything" lists say which source the item is from; others only take their own category
        json: { externalId: r.externalId, ...(category.id === "anything" ? { itemCategory: source } : {}) },
      });
      showNewEntry(entry);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add that");
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(key);
        return n;
      });
    }
  }

  async function persist(order: OrderPayload) {
    const serialized = JSON.stringify(order);
    if (serialized === lastSaved.current) return;
    lastSaved.current = serialized;
    try {
      await api(`/api/lists/${listId}/order`, { method: "PUT", json: { entries: order } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the new order");
      router.refresh();
    }
  }

  /** Save this list's own names for an entry; shows the change at once and undoes it on error. */
  async function saveLabels(entry: EntryWithItem, labels: EntryLabels): Promise<boolean> {
    const prevRanked = ranked;
    const prevContainers = containers;
    const update = (e: EntryWithItem) => (e.id === entry.id ? applyLabels(e, labels) : e);
    setRanked((r) => ({ slots: r.slots.map((s) => s && update(s)), pool: r.pool.map(update) }));
    setContainers((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.map(update)])));
    try {
      await api(`/api/lists/${listId}/entries/${entry.id}`, { method: "PATCH", json: labels });
      return true;
    } catch (e) {
      setRanked(prevRanked);
      setContainers(prevContainers);
      toast.error(e instanceof Error ? e.message : "Couldn't rename that");
      return false;
    }
  }

  function changeRanked(next: RankedState) {
    setRanked(next);
    void persist(slots.toOrderPayload(next));
  }

  async function removeEntry(entry: EntryWithItem) {
    const prevContainers = containers;
    const prevRanked = ranked;
    const nextContainers = Object.fromEntries(
      Object.entries(containers).map(([k, v]) => [k, v.filter((e) => e.id !== entry.id)]),
    );
    const nextRanked = slots.remove(ranked, entry.id);
    setContainers(nextContainers);
    setRanked(nextRanked);
    try {
      await api(`/api/lists/${listId}/entries/${entry.id}`, { method: "DELETE" });
      lastSaved.current = JSON.stringify(payloadNow(nextContainers, nextRanked));
    } catch (e) {
      setContainers(prevContainers);
      setRanked(prevRanked);
      toast.error(e instanceof Error ? e.message : "Couldn't remove that");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Your ranking" className="order-2 min-w-0 lg:order-1">
        {format === "ranked" && (
          <ViewBar
            display={display}
            onChange={setDisplay}
            filledSpots={ranked.slots.slice(0, display.gridColumns * display.gridRows).filter(Boolean).length}
            hasGaps={slots.hasGaps(ranked)}
            onRemoveGaps={() => changeRanked(slots.compact(ranked))}
            saveImage={
              <SaveImageButton title={listTitle} slots={ranked.slots} display={display} aspect={category.aspect} />
            }
          />
        )}
        {format === "ranked" ? (
          allEntries.length === 0 && display.view === "list" ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="font-medium">Your list is empty</p>
              <p className="mt-1 text-sm text-muted">Search for {category.label.toLowerCase()} and click to add them.</p>
            </div>
          ) : (
            <RankedEditor
              state={ranked}
              display={display}
              aspect={category.aspect}
              onChange={changeRanked}
              onRemove={removeEntry}
              onEdit={setEditing}
            />
          )
        ) : (
          <TierBoard
            tiers={tiers}
            aspect={category.aspect}
            containers={containers}
            onChange={setContainers}
            onCommit={(next) => void persist(toOrderPayload(next))}
            onRemove={removeEntry}
            onEdit={setEditing}
          />
        )}
        {allEntries.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            {format === "ranked"
              ? "Drag onto any slot (gaps are fine) or click a rank number to type one. Click an item to rename it in this list. Keyboard: focus an item, press Space, use the arrow keys, then press Space again."
              : "Drag to reorder. Click a cover to rename it in this list. Keyboard: focus a cover, press Space, use the arrow keys, then press Space again."}
          </p>
        )}
        {editing && (
          <ItemEditDialog
            key={editing.id}
            entry={editing}
            category={category}
            onSave={(labels) => saveLabels(editing, labels)}
            onClose={() => setEditing(null)}
          />
        )}
      </section>
      <aside className="order-1 lg:order-2">
        <div className="rounded-xl border border-border bg-surface p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {format === "ranked" ? (
            <div role="tablist" aria-label="Side panel" className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
              {(
                [
                  ["add", `Add ${category.label.toLowerCase()}`],
                  ["customize", "Customize"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  id={`panel-tab-${value}`}
                  aria-selected={panel === value}
                  aria-controls={`panel-${value}`}
                  onClick={() => setPanel(value)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 truncate rounded-md px-2 py-1.5 text-sm font-medium",
                    panel === value ? "bg-surface shadow-sm" : "text-muted hover:text-foreground",
                  )}
                >
                  {value === "customize" && <SlidersHorizontal className="size-3.5 shrink-0" />}
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <h2 className="mb-2 text-sm font-semibold">Add {category.label.toLowerCase()}</h2>
          )}
          <div
            id="panel-add"
            role={format === "ranked" ? "tabpanel" : undefined}
            aria-labelledby={format === "ranked" ? "panel-tab-add" : undefined}
            hidden={format === "ranked" && panel !== "add"}
          >
            <SearchPanel
              category={category}
              addedKeys={added}
              pendingKeys={pending}
              onAdd={addItem}
              onAddCustom={addCustom}
            />
          </div>
          {format === "ranked" && panel === "customize" && (
            <div id="panel-customize" role="tabpanel" aria-labelledby="panel-tab-customize">
              <CustomizePanel display={display} onChange={setDisplay} creatorLabel={category.creatorLabel} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

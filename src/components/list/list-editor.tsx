"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CategoryInfo } from "@/catalog/categories";
import type { CatalogResult } from "@/catalog/types";
import type { ListTier } from "@/db/schema";
import type { EntryWithItem } from "@/repositories/entries";
import type { ListDisplay } from "@/lib/list-display";
import { api } from "@/lib/utils";
import { DisplayControls } from "./display-controls";
import { EditorBoard, RANKED, UNSORTED, toContainers, toOrderPayload, type Containers } from "./editor-board";
import { SearchPanel } from "./search-panel";

export function ListEditor({
  listId,
  format,
  tiers,
  initialEntries,
  initialDisplay,
  category,
}: {
  listId: string;
  format: "ranked" | "tier";
  tiers: ListTier[];
  initialEntries: EntryWithItem[];
  initialDisplay: ListDisplay;
  category: CategoryInfo;
}) {
  const router = useRouter();
  const [containers, setContainers] = useState<Containers>(() => toContainers(format, tiers, initialEntries));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const lastSaved = useRef(JSON.stringify(toOrderPayload(containers)));
  const [display, setDisplay] = useState(initialDisplay);
  const savedDisplay = useRef(initialDisplay);

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

  const allEntries = useMemo(() => Object.values(containers).flat(), [containers]);
  const added = useMemo(() => new Set(allEntries.map((e) => e.item.externalId)), [allEntries]);

  /** Put a newly created entry at the end (ranked) or in the unsorted pool (tier). */
  function appendEntry(entry: EntryWithItem) {
    setContainers((c) => {
      const key = format === "ranked" ? RANKED : UNSORTED;
      const next = { ...c, [key]: [...c[key], entry] };
      lastSaved.current = JSON.stringify(toOrderPayload(next));
      return next;
    });
    toast.success(`Added ${entry.item.title}`, { duration: 1500 });
  }

  async function addCustom(form: FormData): Promise<boolean> {
    try {
      const { entry } = await api<{ entry: EntryWithItem }>(`/api/lists/${listId}/custom-entries`, {
        method: "POST",
        body: form,
      });
      appendEntry(entry);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add that");
      return false;
    }
  }

  async function addItem(r: CatalogResult) {
    setPending((p) => new Set(p).add(r.externalId));
    try {
      const { entry } = await api<{ entry: EntryWithItem }>(`/api/lists/${listId}/entries`, {
        method: "POST",
        json: { externalId: r.externalId },
      });
      appendEntry(entry);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add that");
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(r.externalId);
        return n;
      });
    }
  }

  async function persist(next: Containers) {
    const order = toOrderPayload(next);
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

  async function removeEntry(entry: EntryWithItem) {
    const prev = containers;
    const next = Object.fromEntries(Object.entries(containers).map(([k, v]) => [k, v.filter((e) => e.id !== entry.id)]));
    setContainers(next);
    try {
      await api(`/api/lists/${listId}/entries/${entry.id}`, { method: "DELETE" });
      lastSaved.current = JSON.stringify(toOrderPayload(next));
    } catch (e) {
      setContainers(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't remove that");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Your ranking" className="order-2 min-w-0 lg:order-1">
        {format === "ranked" && (
          <DisplayControls display={display} onChange={setDisplay} itemCount={allEntries.length} />
        )}
        {allEntries.length === 0 && format === "ranked" && display.view === "list" ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="font-medium">Your list is empty</p>
            <p className="mt-1 text-sm text-muted">Search for {category.label.toLowerCase()} and click to add them.</p>
          </div>
        ) : (
          <EditorBoard
            format={format}
            tiers={tiers}
            aspect={category.aspect}
            display={display}
            containers={containers}
            onChange={setContainers}
            onCommit={persist}
            onRemove={removeEntry}
          />
        )}
        {allEntries.length > 1 && (
          <p className="mt-3 text-xs text-muted">
            Drag to reorder. Keyboard: focus {display.view === "grid" && format === "ranked" ? "a cover" : "a handle"}, press
            Space, use the arrow keys, then press Space again.
          </p>
        )}
      </section>
      <aside className="order-1 lg:order-2">
        <div className="rounded-xl border border-border bg-surface p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <h2 className="mb-2 text-sm font-semibold">Add {category.label.toLowerCase()}</h2>
          <SearchPanel category={category} addedExternalIds={added} pendingExternalIds={pending}
            onAdd={addItem}
            onAddCustom={addCustom}
          />
        </div>
      </aside>
    </div>
  );
}

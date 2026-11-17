"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import type { CategoryInfo } from "@/catalog/categories";
import type { EntryWithItem } from "@/repositories/entries";
import type { EntryLabels } from "@/lib/entry-labels";
import { Button, Cover, Input, Label } from "@/components/ui";

/**
 * "Edit item": this list's own names for an item ("P5R" for "Persona 5 Royal")
 * and its creator. Blank = the catalog's name. A native <dialog> gives focus
 * trapping, Esc to close and a backdrop; on phones it sits at the bottom.
 */
export function ItemEditDialog({
  entry,
  category,
  onSave,
  onClose,
}: {
  entry: EntryWithItem;
  category: CategoryInfo;
  /** resolves true when saved */
  onSave: (labels: EntryLabels) => Promise<boolean>;
  onClose: () => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(entry.customTitle ?? "");
  const [creator, setCreator] = useState(entry.customSubtitle ?? "");
  const [saving, setSaving] = useState(false);
  const { item } = entry;

  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // showModal() moves focus to the first button; start typing in the name instead.
    titleInput.current?.focus();
    titleInput.current?.select();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave({ displayTitle: title.trim() || null, displaySubtitle: creator.trim() || null });
    setSaving(false);
    if (ok) ref.current?.close();
  }

  const changed = title.trim() !== "" || creator.trim() !== "";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself, outside the panel) closes it.
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby={`${id}-heading`}
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/60 sm:m-auto sm:max-w-md sm:rounded-2xl"
    >
      <form method="dialog" onSubmit={save} className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${id}-heading`} className="text-base font-semibold">
            Edit item
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="-m-1 rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-2">
          <Cover src={item.imageUrl} alt="" aspect={category.aspect} className={category.aspect === "square" ? "w-12" : "w-10"} />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{item.originalTitle}</p>
            <p className="truncate text-muted">
              {[item.originalSubtitle, item.year].filter(Boolean).join(" · ") || " "}
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor={`${id}-title`}>Display name</Label>
          <Input
            ref={titleInput}
            id={`${id}-title`}
            value={title}
            maxLength={200}
            placeholder={item.originalTitle}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-creator`}>{category.creatorLabel}</Label>
          <Input
            id={`${id}-creator`}
            value={creator}
            maxLength={200}
            placeholder={item.originalSubtitle ?? `No ${category.creatorLabel.toLowerCase()} listed`}
            onChange={(e) => setCreator(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted">Only changes how it reads in this list. Leave blank to use the original.</p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={!changed}
            onClick={() => {
              setTitle("");
              setCreator("");
            }}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground disabled:opacity-40 disabled:hover:text-muted"
          >
            <RotateCcw className="size-3.5" /> Reset to original
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => ref.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

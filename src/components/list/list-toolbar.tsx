"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Pencil, Share2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import type { PublicUser } from "@/repositories/users";
import { Avatar, Button, Input } from "@/components/ui";
import { api, cn } from "@/lib/utils";

export function EditableTitle({ listId, initial }: { listId: string; initial: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initial);

  async function save() {
    const t = title.trim();
    setEditing(false);
    if (!t || t === initial) {
      setTitle(initial);
      return;
    }
    try {
      await api(`/api/lists/${listId}`, { method: "PATCH", json: { title: t } });
      router.refresh();
    } catch (e) {
      setTitle(initial);
      toast.error(e instanceof Error ? e.message : "Couldn't rename the list");
    }
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={title}
        maxLength={100}
        aria-label="List title"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setTitle(initial);
            setEditing(false);
          }
        }}
        className="h-11 max-w-lg text-2xl font-bold"
      />
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)} className="group flex items-center gap-2 text-left">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <Pencil className="size-4 text-muted opacity-0 transition group-hover:opacity-100" aria-label="Rename" />
    </button>
  );
}

export function OwnerActions({
  listId,
  visibility,
  friends,
  sharedWith,
}: {
  listId: string;
  visibility: "private" | "friends";
  friends: PublicUser[];
  sharedWith: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vis, setVis] = useState(visibility);
  const [shared, setShared] = useState(new Set(sharedWith));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function setVisibility(next: "private" | "friends") {
    const prev = vis;
    setVis(next);
    try {
      await api(`/api/lists/${listId}`, { method: "PATCH", json: { visibility: next } });
      router.refresh();
    } catch (e) {
      setVis(prev);
      toast.error(e instanceof Error ? e.message : "Couldn't update visibility");
    }
  }

  async function toggleShare(friend: PublicUser) {
    const isShared = shared.has(friend.id);
    const next = new Set(shared);
    if (isShared) next.delete(friend.id);
    else next.add(friend.id);
    setShared(next);
    try {
      await api(`/api/lists/${listId}/shares`, { method: isShared ? "DELETE" : "POST", json: { userId: friend.id } });
      if (!isShared) toast.success(`Shared with @${friend.username}`);
    } catch (e) {
      setShared(shared);
      toast.error(e instanceof Error ? e.message : "Couldn't update sharing");
    }
  }

  async function deleteList() {
    if (!window.confirm("Delete this list? This can't be undone.")) return;
    try {
      await api(`/api/lists/${listId}`, { method: "DELETE" });
      router.replace("/lists");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the list");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={panelRef}>
        <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Share2 className="size-4" /> Share
        </Button>
        {open && (
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Who can see this</p>
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
              {(
                [
                  ["private", "Only me", Lock],
                  ["friends", "All friends", Users],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={vis === value}
                  onClick={() => setVisibility(value)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium",
                    vis === value ? "bg-surface shadow-sm" : "text-muted",
                  )}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Share with specific friends</p>
            {friends.length === 0 ? (
              <p className="py-2 text-sm text-muted">Add friends to share lists with them.</p>
            ) : (
              <ul className="max-h-60 overflow-y-auto">
                {friends.map((f) => {
                  const on = shared.has(f.id) || vis === "friends";
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        disabled={vis === "friends"}
                        onClick={() => toggleShare(f)}
                        className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-surface-2 disabled:hover:bg-transparent"
                      >
                        <Avatar name={f.name || f.username} src={f.image} className="size-7 text-xs" />
                        <span className="min-w-0 flex-1 truncate">@{f.username}</span>
                        {on && <Check className="size-4 text-success" aria-label="Can see this list" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {vis === "friends" && friends.length > 0 && (
              <p className="mt-2 text-xs text-muted">Every friend can already see this list.</p>
            )}
          </div>
        )}
      </div>
      <Button variant="danger" size="sm" onClick={deleteList} aria-label="Delete list">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

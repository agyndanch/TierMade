"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui";

export type CompareCandidate = { id: string; title: string; ownerUsername: string; entryCount: number };

/**
 * "Compare with…" dropdown. `thisListId` is always placed on the side that
 * belongs to the viewer: mine on the left (a), theirs on the right (b).
 */
export function CompareMenu({
  thisListId,
  isOwner,
  candidates,
  createHref,
}: {
  thisListId: string;
  isOwner: boolean;
  candidates: CompareCandidate[];
  createHref: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const href = (other: string) =>
    isOwner ? `/compare?a=${thisListId}&b=${other}` : `/compare?a=${other}&b=${thisListId}`;

  return (
    <div className="relative" ref={ref}>
      <Button variant={isOwner ? "secondary" : "primary"} size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <GitCompareArrows className="size-4" /> {isOwner ? "Compare" : "Compare with mine"}
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-border bg-surface p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {isOwner ? "Friends' lists in this category" : "Your lists in this category"}
          </p>
          {candidates.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted">
              {isOwner ? (
                "None of your friends have shared a list in this category yet."
              ) : (
                <>
                  You don’t have one yet.{" "}
                  <Link href={createHref} className="font-medium text-accent hover:underline">
                    Make one
                  </Link>{" "}
                  and come back.
                </>
              )}
            </div>
          ) : (
            <ul>
              {candidates.map((c) => (
                <li key={c.id}>
                  <Link href={href(c.id)} className="block rounded-lg px-2 py-1.5 hover:bg-surface-2">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="block text-xs text-muted">
                      {isOwner ? `@${c.ownerUsername} · ` : ""}
                      {c.entryCount} items
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

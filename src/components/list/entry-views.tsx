import { forwardRef, type HTMLAttributes } from "react";
import { GripVertical, X } from "lucide-react";
import type { EntryWithItem } from "@/repositories/entries";
import { Cover } from "@/components/ui";
import { cn } from "@/lib/utils";

type Aspect = "square" | "portrait";

/** One row in a ranked list. */
export const RankedRow = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    entry: EntryWithItem;
    rank: number;
    aspect: Aspect;
    dragging?: boolean;
    overlay?: boolean;
    handleProps?: HTMLAttributes<HTMLButtonElement>;
    onRemove?: () => void;
    highlight?: boolean;
    badge?: React.ReactNode;
  }
>(function RankedRow({ entry, rank, aspect, dragging, overlay, handleProps, onRemove, highlight, badge, className, ...rest }, ref) {
  const { item } = entry;
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-surface p-2 pr-3",
        dragging && "opacity-40",
        overlay && "shadow-lg ring-2 ring-accent",
        highlight && "border-accent ring-1 ring-accent",
        className,
      )}
      {...rest}
    >
      {handleProps && (
        <button
          type="button"
          aria-label={`Drag to reorder ${item.title}`}
          className="touch-none cursor-grab rounded p-1 text-muted hover:bg-surface-2 active:cursor-grabbing"
          {...handleProps}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <span className="w-7 shrink-0 text-center text-lg font-bold tabular-nums text-muted">{rank}</span>
      <Cover src={item.imageUrl} alt={item.title} aspect={aspect} className={aspect === "square" ? "w-12" : "w-10"} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.title}</p>
        <p className="truncate text-sm text-muted">
          {[item.subtitle, item.year].filter(Boolean).join(" · ") || " "}
        </p>
      </div>
      {badge}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${item.title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
});

/** One cover tile inside a tier row. */
export const TierTile = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    entry: EntryWithItem;
    aspect: Aspect;
    dragging?: boolean;
    overlay?: boolean;
    onRemove?: () => void;
    highlight?: boolean;
    badge?: React.ReactNode;
  }
>(function TierTile({ entry, aspect, dragging, overlay, onRemove, highlight, badge, className, ...rest }, ref) {
  const { item } = entry;
  const label = [item.title, item.subtitle, item.year].filter(Boolean).join(" · ");
  return (
    <div
      ref={ref}
      title={label}
      className={cn(
        "group relative w-16 shrink-0 sm:w-[72px]",
        dragging && "opacity-40",
        overlay && "rotate-2 shadow-xl",
        className,
      )}
      {...rest}
    >
      <Cover
        src={item.imageUrl}
        alt={item.title}
        aspect={aspect}
        className={cn("w-full", highlight && "ring-2 ring-accent ring-offset-1 ring-offset-surface")}
      />
      {badge}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${item.title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-foreground p-0.5 text-background shadow group-hover:block group-focus-within:block"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
});

/** A cover filling one cell of a ranked list's grid view. */
export const GridTile = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    entry: EntryWithItem;
    aspect: Aspect;
    dragging?: boolean;
    overlay?: boolean;
    onRemove?: () => void;
  }
>(function GridTile({ entry, aspect, dragging, overlay, onRemove, className, ...rest }, ref) {
  const { item } = entry;
  const label = [item.title, item.subtitle, item.year].filter(Boolean).join(" · ");
  return (
    <div
      ref={ref}
      title={label}
      className={cn(
        "group relative min-w-0",
        dragging && "opacity-40",
        overlay && "rounded-md shadow-xl ring-2 ring-accent",
        className,
      )}
      {...rest}
    >
      <Cover src={item.imageUrl} alt={item.title} aspect={aspect} className="w-full" />
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${item.title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="absolute right-1 top-1 hidden rounded-full bg-foreground/90 p-0.5 text-background shadow group-hover:block group-focus-within:block"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
});

export function TierLabel({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="flex w-14 shrink-0 items-center justify-center text-xl font-bold text-black/80 sm:w-16"
      style={{ background: color }}
    >
      {label}
    </div>
  );
}

import { forwardRef, type HTMLAttributes, type MouseEvent } from "react";
import { GripVertical, Pencil, X } from "lucide-react";
import type { EntryWithItem } from "@/repositories/entries";
import { Cover } from "@/components/ui";
import { entryTooltip } from "@/lib/entry-labels";
import { cn } from "@/lib/utils";

type Aspect = "square" | "portrait";

/** Keeps a click on an inner control (remove, edit, rank…) from also opening the item editor. */
const stop = (e: MouseEvent | React.PointerEvent) => e.stopPropagation();

/** Small round icon button shown on a cover when it's hovered or focused. */
function TileButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={stop}
      // Enter/Space here must press this button, not start a keyboard drag of the cover behind it.
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        stop(e);
        onClick();
      }}
      className={cn(
        "absolute hidden rounded-full bg-foreground/90 p-0.5 text-background shadow group-hover:block group-focus-within:block",
        className,
      )}
    >
      {children}
    </button>
  );
}

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
    /** clicking the row (or its pencil) opens the item editor */
    onEdit?: () => void;
    highlight?: boolean;
    badge?: React.ReactNode;
    /** replaces the plain rank number (e.g. with a "move to #" control) */
    rankControl?: React.ReactNode;
  }
>(function RankedRow(
  { entry, rank, aspect, dragging, overlay, handleProps, onRemove, onEdit, highlight, badge, rankControl, className, ...rest },
  ref,
) {
  const { item } = entry;
  return (
    <div
      ref={ref}
      title={onEdit ? entryTooltip(item) : undefined}
      onClick={onEdit}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-surface p-2 pr-3",
        onEdit && "cursor-pointer hover:border-accent/50",
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
          onClick={stop}
          className="touch-none cursor-grab rounded p-1 text-muted hover:bg-surface-2 active:cursor-grabbing"
          {...handleProps}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      {rankControl ?? <span className="w-7 shrink-0 text-center text-lg font-bold tabular-nums text-muted">{rank}</span>}
      <Cover src={item.imageUrl} alt={item.title} aspect={aspect} className={aspect === "square" ? "w-12" : "w-10"} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.title}</p>
        <p className="truncate text-sm text-muted">
          {[item.subtitle, item.year].filter(Boolean).join(" · ") || " "}
        </p>
      </div>
      {badge}
      {onEdit && (
        <button
          type="button"
          aria-label={`Edit ${item.title}`}
          title="Edit name"
          onPointerDown={stop}
          onClick={(e) => {
            stop(e);
            onEdit();
          }}
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${item.title}`}
          onPointerDown={stop}
          onClick={(e) => {
            stop(e);
            onRemove();
          }}
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
    /** clicking the cover (or its pencil) opens the item editor */
    onEdit?: () => void;
    highlight?: boolean;
    badge?: React.ReactNode;
  }
>(function TierTile({ entry, aspect, dragging, overlay, onRemove, onEdit, highlight, badge, className, ...rest }, ref) {
  const { item } = entry;
  return (
    <div
      ref={ref}
      title={entryTooltip(item)}
      onClick={onEdit}
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
      {onEdit && (
        <TileButton label={`Edit ${item.title}`} onClick={onEdit} className="-left-1.5 -top-1.5">
          <Pencil className="size-3" />
        </TileButton>
      )}
      {onRemove && (
        <TileButton label={`Remove ${item.title}`} onClick={onRemove} className="-right-1.5 -top-1.5">
          <X className="size-3" />
        </TileButton>
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
    /** clicking the cover (or its pencil) opens the item editor */
    onEdit?: () => void;
  }
>(function GridTile({ entry, aspect, dragging, overlay, onRemove, onEdit, className, ...rest }, ref) {
  const { item } = entry;
  return (
    <div
      ref={ref}
      title={entryTooltip(item)}
      onClick={onEdit}
      className={cn(
        "group relative min-w-0",
        dragging && "opacity-40",
        overlay && "rounded-md shadow-xl ring-2 ring-accent",
        className,
      )}
      {...rest}
    >
      <Cover src={item.imageUrl} alt={item.title} aspect={aspect} className="w-full" />
      {onEdit && (
        <TileButton label={`Edit ${item.title}`} onClick={onEdit} className="left-1 top-1">
          <Pencil className="size-3" />
        </TileButton>
      )}
      {onRemove && (
        <TileButton label={`Remove ${item.title}`} onClick={onRemove} className="right-1 top-1">
          <X className="size-3" />
        </TileButton>
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

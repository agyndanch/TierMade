"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BookOpen, Clapperboard, Disc3, Gamepad2, ListOrdered, Music, Rows3, Sparkles, Tv } from "lucide-react";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/catalog/categories";
import { Button, Input, Label } from "@/components/ui";
import { api, cn } from "@/lib/utils";

const ICONS: Record<CategoryId, typeof Disc3> = {
  albums: Disc3,
  songs: Music,
  games: Gamepad2,
  films: Clapperboard,
  tv: Tv,
  anime: Sparkles,
  manga: BookOpen,
};

export function NewListForm({ initialCategory }: { initialCategory?: CategoryId }) {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryId>(initialCategory ?? "albums");
  const [format, setFormat] = useState<"ranked" | "tier">("ranked");
  const [visibility, setVisibility] = useState<"private" | "friends">("friends");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const title = String(new FormData(e.currentTarget).get("title") ?? "");
    try {
      const { list } = await api<{ list: { id: string } }>("/api/lists", {
        method: "POST",
        json: { title, category, format, visibility },
      });
      router.push(`/lists/${list.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the list");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Category</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORY_IDS.map((id) => {
            const Icon = ICONS[id];
            const selected = id === category;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition",
                  selected
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface hover:border-accent/50",
                )}
              >
                <Icon className="size-6" />
                {CATEGORIES[id].label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={100}
          placeholder={`My top ${CATEGORIES[category].label.toLowerCase()}`}
          autoFocus
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Format</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              { id: "ranked", title: "Ranked list", body: "Order everything from #1 down.", Icon: ListOrdered },
              { id: "tier", title: "Tier list", body: "Sort into S, A, B, C and D tiers.", Icon: Rows3 },
            ] as const
          ).map(({ id, title, body, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={format === id}
              onClick={() => setFormat(id)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                format === id ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent/50",
              )}
            >
              <Icon className={cn("mt-0.5 size-5", format === id ? "text-accent" : "text-muted")} />
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-sm text-muted">{body}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--accent)]"
          checked={visibility === "friends"}
          onChange={(e) => setVisibility(e.target.checked ? "friends" : "private")}
        />
        Let all my friends see this list
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create list"}
      </Button>
    </form>
  );
}

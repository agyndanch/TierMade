"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { CategoryInfo } from "@/catalog/categories";
import { Button, Input, Label } from "@/components/ui";
import { MAX_IMAGE_BYTES } from "@/lib/images";
import { resizeImage } from "@/lib/image-resize";
import { cn } from "@/lib/utils";

const isHttpsUrl = (v: string) => {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/** Add something the catalog doesn't have: title, creator and a cover (file or link). */
export function CustomItemForm({
  category,
  initialTitle,
  onSubmit,
  onCancel,
}: {
  category: CategoryInfo;
  initialTitle: string;
  /** resolves true when the item was added */
  onSubmit: (form: FormData) => Promise<boolean>;
  onCancel: () => void;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [creator, setCreator] = useState("");
  const [file, setFile] = useState<Blob | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [linkBroken, setLinkBroken] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Free the object URL of a replaced or abandoned preview.
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const linkOk = link.trim() !== "" && isHttpsUrl(link.trim());
  const preview = filePreview ?? (linkOk && !linkBroken ? link.trim() : null);

  async function takeFile(f: File | undefined | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("That file isn't an image");
      return;
    }
    setProcessing(true);
    try {
      let blob: Blob = f;
      try {
        blob = await resizeImage(f);
      } catch {
        // Couldn't decode/resize in this browser; upload as-is if it's small enough.
      }
      if (blob.size > MAX_IMAGE_BYTES) {
        toast.error("That image is too large. Try a smaller one.");
        return;
      }
      setFile(blob);
      setFilePreview(URL.createObjectURL(blob));
      setLink("");
    } finally {
      setProcessing(false);
    }
  }

  function clearImage() {
    setFile(null);
    setFilePreview(null);
    setLink("");
    setLinkBroken(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give it a title");
      return;
    }
    if (link.trim() && !linkOk) {
      toast.error("Image links must start with https://");
      return;
    }
    const form = new FormData();
    form.set("title", title.trim());
    if (creator.trim()) form.set("creator", creator.trim());
    if (file) form.set("image", file, file.type === "image/webp" ? "cover.webp" : "cover.jpg");
    else if (linkOk) form.set("imageUrl", link.trim());
    setSaving(true);
    const ok = await onSubmit(form);
    setSaving(false);
    if (ok) clearImage();
  }

  return (
    <form
      onSubmit={submit}
      method="post"
      className="flex flex-col gap-3"
      onPaste={(e) => {
        const pasted = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
        if (pasted) {
          e.preventDefault();
          void takeFile(pasted);
        }
      }}
    >
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1 self-start text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to search
      </button>
      <p className="text-sm font-medium">Add a custom {category.noun}</p>

      <div>
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input
          id={`${id}-title`}
          value={title}
          maxLength={200}
          required
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${id}-creator`}>
          {category.creatorLabel} <span className="font-normal text-muted">(optional)</span>
        </Label>
        <Input id={`${id}-creator`} value={creator} maxLength={200} onChange={(e) => setCreator(e.target.value)} />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">
          Cover <span className="font-normal text-muted">(optional)</span>
        </span>
        <div className="flex items-start gap-3">
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a cover image"
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInput.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void takeFile(e.dataTransfer.files[0]);
            }}
            className={cn(
              "relative flex w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-surface-2 text-muted transition hover:border-accent",
              category.aspect === "square" ? "aspect-square" : "aspect-[2/3]",
              dragOver && "border-accent bg-accent-soft",
            )}
          >
            {processing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Cover preview"
                referrerPolicy="no-referrer"
                className="size-full object-cover"
                onError={() => !filePreview && setLinkBroken(true)}
              />
            ) : (
              <ImagePlus className="size-6" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-xs text-muted">
            <p>Click, drop or paste an image.</p>
            <Input
              type="url"
              inputMode="url"
              placeholder="or paste an image link (https://…)"
              aria-label="Image link"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setLinkBroken(false);
                setFile(null);
                setFilePreview(null);
              }}
              className="h-9 text-sm"
            />
            {linkOk && linkBroken && <p className="text-danger">Couldn&rsquo;t load an image from that link.</p>}
            {(file || link) && (
              <button type="button" onClick={clearImage} className="inline-flex items-center gap-1 hover:text-foreground">
                <X className="size-3" /> Remove image
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void takeFile(e.target.files?.[0])}
        />
      </div>

      <Button type="submit" disabled={saving || processing || !title.trim()}>
        {saving && <Loader2 className="size-4 animate-spin" />} Add to list
      </Button>
    </form>
  );
}

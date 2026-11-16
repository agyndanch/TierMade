"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Input, Label } from "@/components/ui";
import { MAX_IMAGE_BYTES } from "@/lib/images";
import { resizeImage } from "@/lib/image-resize";
import { api, cn } from "@/lib/utils";
import { BIO_MAX } from "@/lib/validation";

export function ProfileForm({
  username,
  initial,
}: {
  username: string;
  initial: { name: string; bio: string; image: string | null };
}) {
  const id = useId();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [avatar, setAvatar] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const shown = avatarPreview ?? (removeAvatar ? null : initial.image);

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
        blob = await resizeImage(f, 256);
      } catch {
        // Couldn't resize in this browser; upload as-is if it's small enough.
      }
      if (blob.size > MAX_IMAGE_BYTES) {
        toast.error("That image is too large. Try a smaller one.");
        return;
      }
      setAvatar(blob);
      setAvatarPreview(URL.createObjectURL(blob));
      setRemoveAvatar(false);
    } finally {
      setProcessing(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.set("name", name.trim());
    form.set("bio", bio.trim());
    if (avatar) form.set("avatar", avatar, avatar.type === "image/webp" ? "avatar.webp" : "avatar.jpg");
    else if (removeAvatar) form.set("removeAvatar", "1");
    setSaving(true);
    try {
      await api("/api/me/profile", { method: "PATCH", body: form });
      toast.success("Profile saved");
      router.push(`/u/${username}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your profile");
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <form
        onSubmit={save}
        method="post"
        className="space-y-5"
        onPaste={(e) => {
          const pasted = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
          if (pasted) {
            e.preventDefault();
            void takeFile(pasted);
          }
        }}
      >
        <div className="flex items-center gap-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a profile photo"
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
              "group relative cursor-pointer rounded-full ring-offset-2 ring-offset-surface transition",
              dragOver ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-accent/60",
            )}
          >
            <Avatar name={name || username} src={shown} className="size-20 text-3xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              {processing ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium">Profile photo</p>
            <p className="text-xs text-muted">Click, drop or paste an image.</p>
            {shown && (
              <button
                type="button"
                onClick={() => {
                  setAvatar(null);
                  setAvatarPreview(null);
                  setRemoveAvatar(Boolean(initial.image));
                  if (fileInput.current) fileInput.current.value = "";
                }}
                className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Remove photo
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void takeFile(e.target.files?.[0])}
          />
        </div>

        <div>
          <Label htmlFor={`${id}-name`}>Display name</Label>
          <Input
            id={`${id}-name`}
            value={name}
            maxLength={50}
            required
            onChange={(e) => setName(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">Your username stays @{username}.</p>
        </div>

        <div>
          <Label htmlFor={`${id}-bio`}>Bio</Label>
          <textarea
            id={`${id}-bio`}
            value={bio}
            maxLength={BIO_MAX}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A line or two about your taste"
            className="block w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-2 focus:outline-accent"
          />
          <p className={cn("mt-1 text-right text-xs", bio.length >= BIO_MAX ? "text-danger" : "text-muted")}>
            {bio.length}/{BIO_MAX}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || processing || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />} Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

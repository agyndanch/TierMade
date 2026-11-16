"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import type { Relationship } from "@/services/profiles";
import { Button, buttonClass } from "@/components/ui";
import { api } from "@/lib/utils";

/** The friend button(s) on a profile, depending on how you know them. */
export function ProfileActions({
  relationship,
  userId,
  username,
  requestId,
}: {
  relationship: Relationship;
  userId: string;
  username: string;
  requestId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  switch (relationship) {
    case "self":
      return (
        <Link href="/settings/profile" className={buttonClass("secondary", "sm")}>
          <Pencil className="size-4" /> Edit profile
        </Link>
      );
    case "none":
      return (
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const res = await api<{ status: "pending" | "accepted" }>("/api/friends/requests", {
                method: "POST",
                json: { username },
              });
              toast.success(res.status === "accepted" ? `You and @${username} are now friends` : `Request sent to @${username}`);
            })
          }
        >
          <UserPlus className="size-4" /> Add friend
        </Button>
      );
    case "request-sent":
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Request sent</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => run(() => api(`/api/friends/${userId}`, { method: "DELETE" }), "Request cancelled")}
          >
            <X className="size-4" /> Cancel
          </Button>
        </div>
      );
    case "request-received":
      return (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={busy || !requestId}
            onClick={() =>
              run(
                () => api(`/api/friends/requests/${requestId}/accept`, { method: "POST" }),
                `You and @${username} are now friends`,
              )
            }
          >
            <Check className="size-4" /> Accept request
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || !requestId}
            onClick={() => run(() => api(`/api/friends/requests/${requestId}/decline`, { method: "POST" }))}
          >
            Decline
          </Button>
        </div>
      );
    case "friends":
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-sm font-medium">
            <Check className="size-4 text-success" /> Friends
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Remove @${username} from your friends?`)) {
                run(() => api(`/api/friends/${userId}`, { method: "DELETE" }), `Removed @${username}`);
              }
            }}
          >
            Remove
          </Button>
        </div>
      );
  }
}

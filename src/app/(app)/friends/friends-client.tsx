"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import type { FriendsOverview } from "@/services/friends";
import type { PublicUser } from "@/repositories/users";
import { Avatar, Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/utils";

function UserRow({ user, children }: { user: PublicUser; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link href={`/u/${user.username}`} className="group flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={user.name || user.username} src={user.image} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium group-hover:text-accent">{user.name}</span>
          <span className="block truncate text-xs text-muted">@{user.username}</span>
        </span>
      </Link>
      <div className="flex shrink-0 gap-1.5">{children}</div>
    </li>
  );
}

export function FriendsClient({ overview }: { overview: FriendsOverview }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [debounced, setDebounced] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(username.trim().replace(/^@/, "")), 250);
    return () => clearTimeout(t);
  }, [username]);

  const { data: suggestions } = useQuery({
    queryKey: ["user-search", debounced],
    queryFn: () => api<{ users: PublicUser[] }>(`/api/users/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const known = new Set([
    ...overview.friends.map((f) => f.id),
    ...overview.incoming.map((f) => f.id),
    ...overview.outgoing.map((f) => f.id),
  ]);

  async function run(key: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await fn();
      if (success) toast.success(success);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  function sendRequest(name: string) {
    return run(
      `send:${name}`,
      async () => {
        const res = await api<{ status: "pending" | "accepted" }>("/api/friends/requests", {
          method: "POST",
          json: { username: name },
        });
        toast.success(res.status === "accepted" ? `You and @${name} are now friends` : `Request sent to @${name}`);
        setUsername("");
      },
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const name = username.trim().replace(/^@/, "");
    if (name) sendRequest(name);
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Add a friend</h2>
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Their username"
            aria-label="Username"
            autoComplete="off"
          />
          <Button type="submit" disabled={!username.trim() || busy !== null}>
            <UserPlus className="size-4" /> Send
          </Button>
        </form>
        {suggestions && suggestions.users.length > 0 && debounced.length >= 2 && (
          <ul className="mt-2 divide-y divide-border">
            {suggestions.users.map((u) => (
              <UserRow key={u.id} user={u}>
                {known.has(u.id) ? (
                  <span className="text-xs text-muted">
                    {overview.friends.some((f) => f.id === u.id) ? "Friends" : "Pending"}
                  </span>
                ) : (
                  <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => sendRequest(u.username)}>
                    Add
                  </Button>
                )}
              </UserRow>
            ))}
          </ul>
        )}
      </Card>

      {overview.incoming.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">Requests for you</h2>
          <ul className="divide-y divide-border">
            {overview.incoming.map((r) => (
              <UserRow key={r.requestId} user={r}>
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() =>
                    run(r.requestId, () => api(`/api/friends/requests/${r.requestId}/accept`, { method: "POST" }), `You and @${r.username} are now friends`)
                  }
                >
                  <Check className="size-4" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => run(r.requestId, () => api(`/api/friends/requests/${r.requestId}/decline`, { method: "POST" }))}
                >
                  Decline
                </Button>
              </UserRow>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-1 text-sm font-semibold">Your friends ({overview.friends.length})</h2>
        {overview.friends.length === 0 ? (
          <p className="py-2 text-sm text-muted">No friends yet. Add someone by username above.</p>
        ) : (
          <ul className="divide-y divide-border">
            {overview.friends.map((f) => (
              <UserRow key={f.id} user={f}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => {
                    if (window.confirm(`Remove @${f.username} from your friends?`)) {
                      run(f.id, () => api(`/api/friends/${f.id}`, { method: "DELETE" }));
                    }
                  }}
                >
                  Remove
                </Button>
              </UserRow>
            ))}
          </ul>
        )}
      </section>

      {overview.outgoing.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">Sent requests</h2>
          <ul className="divide-y divide-border">
            {overview.outgoing.map((r) => (
              <UserRow key={r.requestId} user={r}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => run(r.id, () => api(`/api/friends/${r.id}`, { method: "DELETE" }))}
                >
                  <X className="size-4" /> Cancel
                </Button>
              </UserRow>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

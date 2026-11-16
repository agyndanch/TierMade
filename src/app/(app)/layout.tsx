import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getFriendsOverview } from "@/services/friends";
import { Avatar } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";
import { NavLink } from "@/components/nav-link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { incoming } = await getFriendsOverview(user.id);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-1 px-4 sm:px-6">
          <Link href="/dashboard" className="mr-3 text-base font-bold tracking-tight">
            TierMade
          </Link>
          <NavLink href="/dashboard">Lists</NavLink>
          <NavLink href="/friends">
            Friends
            {incoming.length > 0 && (
              <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                {incoming.length}
              </span>
            )}
          </NavLink>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/u/${user.username}`}
              aria-label="Your profile"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-surface-2"
            >
              <Avatar name={user.name || user.username} src={user.image} className="size-7 text-xs" />
              <span className="hidden text-muted sm:inline">@{user.username}</span>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-xs text-muted sm:px-6">
        Music data from Deezer · Game data from IGDB · Film &amp; TV data from TMDB. This product uses the TMDB API but
        is not endorsed or certified by TMDB.
      </footer>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // Exact page, or anything under it. Exception: a single list (/lists/<id>)
  // can be yours or a friend's, so My Lists only lights up for /lists and /lists/new.
  const active =
    href === "/lists"
      ? pathname === "/lists" || pathname === "/lists/new"
      : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg px-2 text-sm font-medium transition sm:px-3",
        active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

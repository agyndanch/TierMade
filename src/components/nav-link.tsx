"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active =
    pathname === href || pathname.startsWith(`${href}/`) || (href === "/dashboard" && pathname.startsWith("/lists"));
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium transition",
        active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

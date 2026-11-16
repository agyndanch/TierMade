"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "./ui";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Log out"
      onClick={async () => {
        await signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Log out</span>
    </Button>
  );
}

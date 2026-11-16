"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { signIn, signUp } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    try {
      if (mode === "signup") {
        const username = String(form.get("username") ?? "").trim();
        const name = String(form.get("name") ?? "").trim() || username;
        const { error } = await signUp.email({ email, password, name, username });
        if (error) throw new Error(error.message ?? "Couldn't create your account");
      } else {
        const { error } = await signIn.email({ email, password });
        if (error) throw new Error(error.message ?? "Wrong email or password");
      }
      router.replace(destination);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "signup" ? "Your friends will find you by your username." : "Log in to your lists."}
      </p>
      {/* method="post": if submitted before hydration, never put credentials in the URL */}
      <form onSubmit={onSubmit} method="post" className="mt-6 space-y-4">
        {mode === "signup" && (
          <>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                required
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]+"
                title="Letters, numbers and underscores only"
                autoComplete="username"
              />
            </div>
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input id="name" name="name" maxLength={50} autoComplete="name" placeholder="Optional" />
            </div>
          </>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Please wait…" : mode === "signup" ? "Sign up" : "Log in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </Card>
  );
}

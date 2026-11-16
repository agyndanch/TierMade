import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export type CurrentUser = {
  id: string;
  name: string;
  username: string;
  image: string | null;
};

/** Returns the signed-in user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { username?: string | null };
  return { id: u.id, name: u.name, username: u.username ?? "", image: u.image ?? null };
});

/** For pages that require auth: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

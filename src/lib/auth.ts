import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins/username";
import { db, schema } from "@/db";

/** "https://x.com/path" or "x.vercel.app" → "x.com" / "x.vercel.app" */
function hostOf(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).host;
  } catch {
    return undefined;
  }
}

// Hosts this app answers on: local dev, an explicit BETTER_AUTH_URL (e.g. a
// custom domain), and the production / branch / per-deployment URLs Vercel
// injects at runtime, so preview deployments can sign in too.
const allowedHosts = [
  "localhost:*",
  "127.0.0.1:*",
  hostOf(process.env.BETTER_AUTH_URL),
  hostOf(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  hostOf(process.env.VERCEL_BRANCH_URL),
  hostOf(process.env.VERCEL_URL),
].filter((h): h is string => Boolean(h));

export const auth = betterAuth({
  baseURL: { allowedHosts, fallback: process.env.BETTER_AUTH_URL },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 24,
      usernameValidator: (name) => /^[a-zA-Z0-9_]+$/.test(name),
    }),
    nextCookies(), // must be last
  ],
});

export type Session = typeof auth.$Infer.Session;

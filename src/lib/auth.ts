import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins/username";
import { db, schema } from "@/db";

export const auth = betterAuth({
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

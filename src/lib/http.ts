import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { CatalogError } from "@/catalog/types";
import { getCurrentUser, type CurrentUser } from "./session";
import { HttpError } from "./errors";

export { HttpError };

/** Wraps a route handler: maps known errors to JSON responses. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: err.issues[0]?.message ?? "Invalid request", issues: err.issues },
          { status: 400 },
        );
      }
      if (err instanceof CatalogError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      // Postgres "invalid input syntax" (e.g. a malformed uuid in the URL):
      // bodies are zod-validated, so this only comes from ids in the path.
      const code = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
      if (code === "22P02") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      console.error(err);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

export async function requireApiUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not signed in");
  return user;
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
  return schema.parse(body);
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

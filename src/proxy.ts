import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only (cookie presence). Real authorization happens in the
// service layer on every request.
const PUBLIC_PATHS = ["/", "/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && !PUBLIC_PATHS.includes(pathname)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (hasSession && (pathname === "/login" || pathname === "/signup" || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes (they return 401 themselves), Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};

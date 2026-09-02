import { NextResponse, type NextRequest } from "next/server";

import { isAuthEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/** Cesty dostupné i bez přihlášení. */
const PUBLIC_PATHS = ["/login", "/api/health"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  const isSignedIn = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && isSignedIn) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (isSignedIn) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);

  if (pathname !== "/") {
    loginUrl.searchParams.set("next", `${pathname}${search}`);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

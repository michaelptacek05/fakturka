import { NextResponse, type NextRequest } from "next/server";

import { isAuthEnabled, SESSION_COOKIE } from "@/lib/auth";
import { isSessionAuthenticated } from "@/lib/auth-session";

/** Cesty dostupné i bez přihlášení. */
const PUBLIC_PATHS = ["/login", "/api/health"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

export async function proxy(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  let isSignedIn: boolean;
  try {
    isSignedIn = await isSessionAuthenticated(request.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    return NextResponse.json({ error: "Přihlášení teď není dostupné." }, { status: 503 });
  }

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

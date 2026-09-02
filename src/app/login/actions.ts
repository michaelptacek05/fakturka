"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createSessionToken,
  getSessionMaxAgeSeconds,
  isAuthEnabled,
  sanitizeRedirectPath,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";

/**
 * Jednoduché omezení pokusů v paměti procesu. Pro single-user self-host
 * to stačí; při restartu aplikace se počítadlo vynuluje.
 */
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 5 * 60 * 1000;

let failedAttempts = 0;
let lockedUntil = 0;

export async function signIn(formData: FormData) {
  const nextPath = sanitizeRedirectPath(
    typeof formData.get("next") === "string"
      ? (formData.get("next") as string)
      : null,
  );

  if (!isAuthEnabled()) {
    redirect(nextPath);
  }

  if (Date.now() < lockedUntil) {
    redirect(`/login?error=locked&next=${encodeURIComponent(nextPath)}`);
  }

  const password = formData.get("password");
  const isValid =
    typeof password === "string" && (await verifyPassword(password));

  if (!isValid) {
    failedAttempts += 1;

    if (failedAttempts >= MAX_ATTEMPTS) {
      failedAttempts = 0;
      lockedUntil = Date.now() + LOCKOUT_MS;

      redirect(`/login?error=locked&next=${encodeURIComponent(nextPath)}`);
    }

    redirect(`/login?error=invalid&next=${encodeURIComponent(nextPath)}`);
  }

  failedAttempts = 0;
  lockedUntil = 0;

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    maxAge: getSessionMaxAgeSeconds(),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(nextPath);
}

export async function signOut() {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE);

  redirect("/login");
}

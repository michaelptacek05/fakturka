"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  getSessionMaxAgeSeconds,
  isAuthEnabled,
  sanitizeRedirectPath,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";
import { createSession, revokeSession } from "@/lib/auth-session";
import { getLoginSource, reserveLoginAttempt } from "@/lib/login-throttle";

export async function signIn(formData: FormData) {
  const nextPath = sanitizeRedirectPath(
    typeof formData.get("next") === "string"
      ? (formData.get("next") as string)
      : null,
  );

  if (!isAuthEnabled()) {
    redirect(nextPath);
  }

  const requestHeaders = await headers();
  const source = getLoginSource(requestHeaders.get("x-real-ip"));
  let allowed = false;
  try {
    allowed = source !== null && await reserveLoginAttempt(source);
  } catch {
    redirect("/login?error=unavailable");
  }
  if (!allowed) redirect(`/login?error=locked&next=${encodeURIComponent(nextPath)}`);

  const password = formData.get("password");
  const isValid =
    typeof password === "string" && password.length <= 1024 && (await verifyPassword(password));

  if (!isValid) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(nextPath)}`);
  }

  let token: string;
  try {
    token = await createSession();
  } catch {
    redirect("/login?error=unavailable");
  }
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
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

  await revokeSession(cookieStore.get(SESSION_COOKIE)?.value);
  cookieStore.delete(SESSION_COOKIE);

  redirect("/login");
}

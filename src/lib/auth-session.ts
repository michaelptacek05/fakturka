import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSessionToken, getAuthFingerprint, getSessionMaxAgeSeconds, isAuthEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createSession() {
  const token = await createSessionToken();
  await prisma.authSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await prisma.authSession.create({ data: {
    tokenHash: await getAuthFingerprint(`session:${token}`),
    expiresAt: new Date(Date.now() + getSessionMaxAgeSeconds() * 1000),
  } });
  return token;
}

export async function isSessionAuthenticated(token: string | undefined | null) {
  if (!(await verifySessionToken(token))) return false;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: await getAuthFingerprint(`session:${token}`) },
    select: { expiresAt: true },
  });
  return Boolean(session && session.expiresAt.getTime() > Date.now());
}

export async function revokeSession(token: string | undefined) {
  if (!token) return;
  await prisma.authSession.deleteMany({
    where: { tokenHash: await getAuthFingerprint(`session:${token}`) },
  });
}

/** Každá serverová hranice ověří přístup před čtením nebo mutací dat. */
export async function requireSession() {
  if (!isAuthEnabled()) return;
  const store = await cookies();
  if (!(await isSessionAuthenticated(store.get(SESSION_COOKIE)?.value))) {
    redirect("/login");
  }
}

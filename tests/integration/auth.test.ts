import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({ state: { token: undefined as string | undefined } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("login-required"); } }));

const { prisma } = await import("@/lib/prisma");
const { createSession, isSessionAuthenticated, requireSession, revokeSession } = await import("@/lib/auth-session");
const { reserveLoginAttempt } = await import("@/lib/login-throttle");

beforeEach(async () => {
  vi.stubEnv("AUTH_PASSWORD", "integration-only-password");
  vi.stubEnv("AUTH_SECRET", "integration-only-secret");
  vi.stubEnv("AUTH_REQUIRED", "true");
  await prisma.authSession.deleteMany();
  await prisma.loginThrottle.deleteMany();
  state.token = undefined;
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("trvalé přihlašování", () => {
  it("odhlášení zneplatní původní token a jiné session zůstanou platné", async () => {
    const first = await createSession();
    const second = await createSession();
    expect(await isSessionAuthenticated(first)).toBe(true);
    await revokeSession(first);
    expect(await isSessionAuthenticated(first)).toBe(false);
    expect(await isSessionAuthenticated(second)).toBe(true);
  });
  it("zamítne chybějící, prošlou nebo po změně hesla neplatnou session", async () => {
    await expect(requireSession()).rejects.toThrow("login-required");
    state.token = await createSession();
    await expect(requireSession()).resolves.toBeUndefined();
    await prisma.authSession.updateMany({ data: { expiresAt: new Date(0) } });
    await expect(requireSession()).rejects.toThrow("login-required");
  });
  it("lokální režim nepotřebuje cookie", async () => {
    vi.stubEnv("AUTH_REQUIRED", "false");
    vi.stubEnv("AUTH_PASSWORD", "");
    await expect(requireSession()).resolves.toBeUndefined();
  });
  it("souběžně rezervuje nejvýše osm pokusů pro zdroj a neblokuje jiný zdroj", async () => {
    const attempts = await Promise.all(Array.from({ length: 24 }, () => reserveLoginAttempt("192.0.2.1")));
    expect(attempts.filter(Boolean)).toHaveLength(8);
    expect(await reserveLoginAttempt("192.0.2.1")).toBe(false);
    expect(await reserveLoginAttempt("192.0.2.2")).toBe(true);
    const stored = await prisma.loginThrottle.findMany();
    expect(stored.every((row) => !row.sourceHash.includes("192.0.2"))).toBe(true);
    await prisma.loginThrottle.updateMany({ data: { windowStartedAt: new Date(Date.now() - 300_001) } });
    expect(await reserveLoginAttempt("192.0.2.1")).toBe(true);
  });
});

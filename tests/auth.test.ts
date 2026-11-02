import { afterEach, describe, expect, it, vi } from "vitest";

import { createSessionToken, getSessionMaxAgeSeconds, isAuthEnabled, sanitizeRedirectPath, verifyPassword, verifySessionToken } from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { getLoginSource } = await import("@/lib/login-throttle");

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

function authEnv() {
  vi.stubEnv("AUTH_PASSWORD", "test-only-password");
  vi.stubEnv("AUTH_SECRET", "test-only-secret");
  vi.stubEnv("AUTH_REQUIRED", "false");
}

describe("hranice přihlášení", () => {
  it("ponechá lokální režim, ale veřejné nasazení nesmí mlčky vypnout login", () => {
    vi.stubEnv("AUTH_PASSWORD", " ");
    vi.stubEnv("AUTH_REQUIRED", "false");
    expect(isAuthEnabled()).toBe(false);
    vi.stubEnv("AUTH_REQUIRED", "true");
    expect(() => isAuthEnabled()).toThrow();
  });

  it("odmítá chybné heslo a změněné nebo prošlé tokeny", async () => {
    authEnv();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    expect(await verifyPassword("wrong")).toBe(false);
    expect(await verifyPassword("test-only-password")).toBe(true);
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
    expect(await verifySessionToken(token.slice(0, -1) + "!")).toBe(false);
    vi.setSystemTime(new Date("2027-01-01T12:00:00Z"));
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("vydává různé tokeny i ve stejné milisekundě a změna hesla/secretu je zneplatní", async () => {
    authEnv();
    const token = await createSessionToken();
    expect(await createSessionToken()).not.toBe(token);
    vi.stubEnv("AUTH_PASSWORD", "different-password");
    expect(await verifySessionToken(token)).toBe(false);
    vi.stubEnv("AUTH_PASSWORD", "test-only-password");
    vi.stubEnv("AUTH_SECRET", "different-secret");
    expect(await verifySessionToken(token)).toBe(false);
  });

  it.each(["//evil.invalid", "/\\evil.invalid", "/\tevil.invalid", "/\nevil.invalid", "https://evil.invalid", "/a\r\nb", "/.//evil.invalid"])
    ("nepřesměruje mimo aplikaci: %s", (path) => {
      const safe = sanitizeRedirectPath(path);
      expect(new URL(safe, "https://fakturka.invalid").origin).toBe("https://fakturka.invalid");
    });

  it("zachová lokální návrat včetně query a fragmentu", () => {
    expect(sanitizeRedirectPath("/invoices?status=PAID#list")).toBe("/invoices?status=PAID#list");
  });

  it.each(["Infinity", "999999999999", "2hours", "-1"])("nepřevezme neplatnou dobu session %s", (value) => {
    vi.stubEnv("AUTH_SESSION_HOURS", value);
    expect(getSessionMaxAgeSeconds()).toBe(720 * 3600);
  });

  it("IP hlavičce důvěřuje pouze při explicitním zapnutí proxy režimu", () => {
    vi.stubEnv("AUTH_TRUST_PROXY", "false");
    expect(getLoginSource("192.0.2.1")).toBe("shared");
    vi.stubEnv("AUTH_TRUST_PROXY", "true");
    expect(getLoginSource("192.0.2.1")).toBe("192.0.2.1");
    expect(getLoginSource(null)).toBeNull();
    expect(getLoginSource("192.0.2.1, 192.0.2.2")).toBeNull();
    expect(getLoginSource("2001:0db8::1")).toBe(getLoginSource("2001:db8:0:0:0:0:0:1"));
  });
});

import { describe, expect, it, vi } from "vitest";

const { denied } = vi.hoisted(() => ({ denied: new Error("authentication-required") }));
vi.mock("@/lib/auth-session", () => ({ requireSession: vi.fn(async () => { throw denied; }) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const modules = [
  await import("@/app/actions"),
  await import("@/app/(app)/projects/actions"),
  await import("@/app/(app)/import/actions"),
];
const actions = modules.flatMap((module) => Object.entries(module));
const handlers = [
  ["CSV", (await import("@/app/(app)/invoices/export/route")).GET],
  ["PDF", (await import("@/app/(app)/invoices/[id]/pdf/route")).GET],
  ["asset", (await import("@/app/invoice-assets/[id]/route")).GET],
  ["ARES", (await import("@/app/api/ares/search/route")).GET],
] as const;

describe("autentizace před zpracováním požadavku", () => {
  it.each(actions)("akce %s ověří session před parametry a databází", async (_name, action) => {
    await expect((action as (...args: unknown[]) => Promise<unknown>)()).rejects.toBe(denied);
  });
  it.each(handlers)("handler %s ověří session před parametry a databází", async (_name, handler) => {
    await expect((handler as (...args: unknown[]) => Promise<unknown>)(undefined, { params: Promise.resolve({ id: "test" }) })).rejects.toBe(denied);
  });
});

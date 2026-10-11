import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect: ${url}`);
  }
}

const { deleteInvoices } = await import("@/app/actions");
const { prisma } = await import("@/lib/prisma");
const { createInvoice, resetDatabase } = await import("./factory");

async function runAction(action: Promise<unknown>) {
  try {
    await action;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("Akce neskončila přesměrováním.");
}

beforeEach(resetDatabase);

describe("deleteInvoices", () => {
  it("smaže pouze vybrané faktury a úspěšné přesměrování nezachytí jako chybu", async () => {
    await createInvoice({ id: "selected-first" });
    await createInvoice({ id: "selected-second" });
    await createInvoice({ id: "unselected" });
    const formData = new FormData();
    formData.append("invoiceId", "selected-first");
    formData.append("invoiceId", "selected-second");

    const target = await runAction(deleteInvoices(formData));

    expect(target).toBe("/invoices?deleted=2");
    expect(await prisma.invoice.findMany({ select: { id: true } })).toEqual([
      { id: "unselected" },
    ]);
  });

  it("prázdný výběr vrátí srozumitelnou chybu a žádnou fakturu nesmaže", async () => {
    await createInvoice({ id: "unselected" });

    const target = await runAction(deleteInvoices(new FormData()));

    expect(target).toBe("/invoices?bulkError=empty");
    expect(await prisma.invoice.findMany({ select: { id: true } })).toEqual([
      { id: "unselected" },
    ]);
  });
});

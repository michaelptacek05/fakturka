import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
const { importInvoices } = await import("@/app/(app)/import/actions");
const { GET: exportInvoices } = await import("@/app/(app)/invoices/export/route");
const { prisma } = await import("@/lib/prisma");
const { createInvoice, resetDatabase } = await import("./factory");

beforeEach(async () => { await resetDatabase(); });
function imported(price: number, number = "IMPORTED") {
  return { number, client: { name: "=1+1" }, issueDate: "2026-11-01", items: [{ unitPrice: price, quantity: "1", vatRate: 0 }] };
}
function form(records: unknown[]) {
  const data = new FormData(); data.set("payload", JSON.stringify(records)); return data;
}

describe("import ověřuje celý payload před zápisem", () => {
  it("přeskočí historický doklad se slevou a zachová jeho položky i platby", async () => {
    await createInvoice({ id: "LEGACY", total: "900.00", status: "PAID", payments: [{ amount: "900.00", paidOn: new Date("2026-09-05") }] });
    const query = { where: { id: "LEGACY" }, include: { items: true, payments: true } };
    const before = await prisma.invoice.findUniqueOrThrow(query);
    const legacy = { ...imported(1000, " LEGACY "), items: [...imported(1000).items, ...imported(-100).items] };
    await expect(importInvoices(form([legacy, imported(50, "NEW")]))).rejects.toThrow("invoicesCreated=1&invoicesSkipped=1");
    expect(await prisma.invoice.findUniqueOrThrow(query)).toEqual(before);
    expect(await prisma.invoice.count()).toBe(2);
  });

  it("přeskočí existující doklad i nad novým limitem položek", async () => {
    await createInvoice({ id: "LEGACY" });
    const legacy = { ...imported(1, "LEGACY"), items: Array.from({ length: 501 }, () => imported(1).items[0]) };
    await expect(importInvoices(form([legacy]))).rejects.toThrow("invoicesCreated=0&invoicesSkipped=1");
    expect(await prisma.invoice.count()).toBe(1);
  });

  it("ověří všechny nové doklady před zápisem i vedle přeskakované historie", async () => {
    await createInvoice({ id: "LEGACY" });
    await expect(importInvoices(form([imported(-100, "LEGACY"), imported(100, "FIRST"), imported(-100, "SECOND")]))).rejects.toThrow("error=amount");
    expect(await prisma.invoice.count()).toBe(1);
    expect(await prisma.client.count()).toBe(1);
  });

  it("odmítne překročený limit i při přímém odeslání bez náhledu", async () => {
    const invoice = { ...imported(1), items: Array.from({ length: 501 }, () => imported(1).items[0]) };
    await expect(importInvoices(form([invoice]))).rejects.toThrow("error=importLimit");
    expect(await prisma.invoice.count()).toBe(0);
    expect(await prisma.client.count()).toBe(1);
  });

  it("přeskočí druhý výskyt stejného čísla v odeslaném payloadu", async () => {
    await expect(importInvoices(form([imported(100), imported(-100)]))).rejects.toThrow("invoicesCreated=1&invoicesSkipped=1");
    expect(await prisma.invoice.count()).toBe(1);
    expect((await prisma.invoice.findFirstOrThrow()).total.toString()).toBe("100");
  });

  it("odmítne záporný pozdější záznam bez částečného zápisu faktur a klientů", async () => {
    await expect(importInvoices(form([imported(100, "FIRST"), imported(-100, "SECOND")]))).rejects.toThrow("error=amount");
    expect(await prisma.invoice.count()).toBe(0);
    expect(await prisma.client.count()).toBe(1);
  });
  it("neutralizuje vzorec ve skutečném exportu a vrátí správnou měnu", async () => {
    await expect(importInvoices(form([{ ...imported(100), currency: "eur" }]))).rejects.toThrow("invoicesCreated=1");
    const invoice = await prisma.invoice.findFirstOrThrow();
    expect(invoice.currency).toBe("EUR");
    const response = await exportInvoices(new Request(`http://localhost/invoices/export?ids=${invoice.id}`));
    const csv = await response.text();
    expect(csv).toContain('"\t=1+1"');
    expect(csv).toContain('"EUR"');
    expect(csv).toContain('"100.00"');
  });
});

import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new RedirectSignal(url); } }));

class RedirectSignal extends Error {
  constructor(public url: string) { super(url); }
}

const { createInvoice, updateInvoice } = await import("@/app/actions");
const { importInvoices } = await import("@/app/(app)/import/actions");
const { prisma } = await import("@/lib/prisma");
const { previewInvoiceImport } = await import("@/lib/fakturoid-import");
const { resetDatabase } = await import("./factory");

async function runAction(action: Promise<unknown>) {
  try { await action; } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("Akce neskončila přesměrováním.");
}

function invoiceForm(quantity: string, unitPrice: string) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    clientName: "Přesný odběratel", clientStreet: "Testovací 1", clientCity: "Praha",
    clientPostalCode: "11000", issueDate: "2026-10-11", dueDate: "2026-10-25",
    itemName: "Přesná položka", quantity, unitPrice, vatRate: "21",
  })) form.set(key, value);
  return form;
}

beforeEach(resetDatabase);

describe("skutečné uložení přesných položek", () => {
  it("vystaví neplátcovský doklad na 15 haléřů a zachová číslo při editaci", async () => {
    const url = await runAction(createInvoice(invoiceForm("0,5", "0,29")));
    const invoice = await prisma.invoice.findFirstOrThrow({ include: { items: true } });
    expect(url).toBe(`/invoices/${invoice.id}`);
    expect(invoice.total.toString()).toBe("0.15");
    expect(invoice.vatTotal.toString()).toBe("0");
    expect(invoice.items[0].quantity.toString()).toBe("0.5");

    await runAction(updateInvoice(invoice.id, invoiceForm("1,234567891", "1000")));
    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { items: true } });
    expect(updated.number).toBe(invoice.number);
    expect(updated.items[0].quantity.toString()).toBe("1.234567891");
    expect(updated.total.toString()).toBe("1234.57");
  });

  it("plátci vypočítá DPH z přesně zaokrouhleného základu", async () => {
    await prisma.userProfile.update({ where: { id: "test-profile" }, data: { vatPayerStatus: "PAYER" } });
    await runAction(createInvoice(invoiceForm("0.5", "0.29")));
    const invoice = await prisma.invoice.findFirstOrThrow();
    expect(invoice.subtotal.toString()).toBe("0.15");
    expect(invoice.vatTotal.toString()).toBe("0.03");
    expect(invoice.total.toString()).toBe("0.18");
  });

  it("příliš přesné množství odmítne bez dokladu a posunu řady", async () => {
    expect(await runAction(createInvoice(invoiceForm("1.2345678912", "1000"))))
      .toBe("/invoices/new?error=quantity");
    expect(await prisma.invoice.count()).toBe(0);
    expect(await prisma.invoiceSequence.count()).toBe(0);
  });

  it("import zachová přesné množství z CSV a druhý import číslo přeskočí", async () => {
    const preview = previewInvoiceImport(
      "number;client_name;issued_on;lines__line__name;lines__line__quantity;lines__line__unit_price\n" +
      "PRECISION-1;Test;2026-10-11;Položka;123456789,123456789;0,01\n",
    );
    const form = new FormData();
    form.set("payload", JSON.stringify(preview.records));
    expect(await runAction(importInvoices(form))).toContain("invoicesCreated=1");
    const invoice = await prisma.invoice.findFirstOrThrow({ include: { items: true } });
    expect(invoice.items[0].quantity.toString()).toBe("123456789.123456789");
    expect(invoice.total.toString()).toBe("1234567.89");
    expect(await runAction(importInvoices(form))).toContain("invoicesSkipped=1");
    expect(await prisma.invoice.count()).toBe(1);
  });

  it("potvrzený payload nelze použít k tichému ořezu množství", async () => {
    const preview = previewInvoiceImport("number;client_name;issued_on;celkem\nINVALID;Test;2026-10-11;100\n");
    preview.records[0].items[0].quantity = "1.0000000001";
    const form = new FormData();
    form.set("payload", JSON.stringify(preview.records));
    expect(await runAction(importInvoices(form))).toBe("/import?error=quantity");
    expect(await prisma.invoice.count()).toBe(0);
  });

  it("migrace zachová starší množství a historické částky", async () => {
    const migration = fs.readFileSync(new URL("../../prisma/migrations/20261011110000_invoice_quantity_precision/migration.sql", import.meta.url), "utf8");
    await prisma.$transaction(async (tx) => {
      // Dočasná tabulka překryje veřejnou jen v tomto spojení a po commitu zmizí.
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "InvoiceItem" (quantity DECIMAL(12,3), total DECIMAL(12,2)) ON COMMIT DROP');
      await tx.$executeRawUnsafe('INSERT INTO "InvoiceItem" VALUES (1.234, 1234.50), (999999999.999, 42.00)');
      await tx.$executeRawUnsafe(migration);
      const rows = await tx.$queryRaw<{ quantity: string; total: string }[]>`SELECT quantity::text, total::text FROM "InvoiceItem" ORDER BY quantity`;
      expect(rows).toEqual([
        { quantity: "1.234000000", total: "1234.50" },
        { quantity: "999999999.999000000", total: "42.00" },
      ]);
    });
  });
});

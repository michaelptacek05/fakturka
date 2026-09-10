import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

vi.mock("next/navigation", () => ({
  /** Skutečný `redirect` vyhazuje interní chybu Nextu, tady stačí cíl. */
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

class RedirectSignal extends Error {
  url: string;

  constructor(url: string) {
    super(`redirect: ${url}`);
    this.url = url;
  }
}

const {
  addInvoicePayment,
  cancelInvoice,
  deleteInvoicePayment,
  markInvoicePaid,
  updateInvoice,
} = await import("@/app/actions");

const { InvoiceStatus } = await import("@/generated/prisma/enums");
const { prisma } = await import("@/lib/prisma");
const { createInvoice, readInvoice, resetDatabase } = await import("./factory");

/** Spustí akci a vrátí adresu, na kterou přesměrovala. */
async function runAction(action: Promise<unknown>) {
  try {
    await action;
  } catch (error) {
    if (error instanceof RedirectSignal) {
      return error.url;
    }

    throw error;
  }

  throw new Error("Akce neskončila přesměrováním.");
}

/**
 * Data se ukládají jako lokální půlnoc, stejně jako datum vystavení
 * a splatnosti. Porovnáváme proto v lokálním čase, ne přes `toISOString`,
 * které by u kladného posunu ukázalo předchozí den.
 */
function toLocalDate(date: Date | null) {
  if (date === null) {
    return null;
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function paymentForm(values: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

beforeEach(async () => {
  await resetDatabase();
});

describe("addInvoicePayment", () => {
  it("částečná úhrada nechá fakturu vystavenou a bez data úhrady", async () => {
    await createInvoice({ total: "10000.00" });

    const url = await runAction(
      addInvoicePayment("test-invoice", paymentForm({ amount: "4000", paidOn: "2026-09-10" })),
    );
    const invoice = await readInvoice();

    expect(url).toBe("/invoices/test-invoice?payment=added");
    expect(invoice.status).toBe(InvoiceStatus.ISSUED);
    expect(invoice.paidAmount).toBe("4000");
    expect(invoice.paidAt).toBeNull();
    expect(invoice.payments).toEqual(["4000"]);
  });

  it("doplacení do plné výše překlopí doklad na zaplacený k datu poslední platby", async () => {
    await createInvoice({
      payments: [{ amount: "4000.00", paidOn: new Date("2026-09-10") }],
      total: "10000.00",
    });

    await runAction(
      addInvoicePayment("test-invoice", paymentForm({ amount: "6000", paidOn: "2026-09-20" })),
    );
    const invoice = await readInvoice();

    expect(invoice.status).toBe(InvoiceStatus.PAID);
    expect(invoice.paidAmount).toBe("10000");
    expect(toLocalDate(invoice.paidAt)).toBe("2026-09-20");
  });

  it("úhrada s čárkou a mezerami se načte správně", async () => {
    await createInvoice({ total: "10000.00" });

    await runAction(
      addInvoicePayment("test-invoice", paymentForm({ amount: "1 234,56" })),
    );

    expect((await readInvoice()).paidAmount).toBe("1234.56");
  });

  it("přeplatek se odmítne a nic se nezapíše", async () => {
    await createInvoice({ total: "10000.00" });

    const url = await runAction(
      addInvoicePayment("test-invoice", paymentForm({ amount: "10001" })),
    );
    const invoice = await readInvoice();

    expect(url).toBe("/invoices/test-invoice?error=payment");
    expect(invoice.paidAmount).toBe("0");
    expect(invoice.payments).toEqual([]);
  });

  it("nulová i nečitelná částka hlásí chybu úhrady, ne chybu ceníku", async () => {
    await createInvoice();

    const nula = await runAction(
      addInvoicePayment("test-invoice", paymentForm({ amount: "0" })),
    );
    const nesmysl = await runAction(
      addInvoicePayment("test-invoice", paymentForm({ amount: "abc" })),
    );

    expect(nula).toBe("/invoices/test-invoice?error=payment");
    expect(nesmysl).toBe("/invoices/test-invoice?error=payment");
    expect((await readInvoice()).payments).toEqual([]);
  });

  it("na stornovaný doklad platbu zapsat nejde", async () => {
    await createInvoice({ status: InvoiceStatus.CANCELLED });

    const url = await runAction(
      addInvoicePayment("test-invoice", paymentForm({ amount: "100" })),
    );

    expect(url).toBe("/invoices/test-invoice?error=readonly");
    expect((await readInvoice()).payments).toEqual([]);
  });

  it("neexistující faktura skončí na seznamu s chybou", async () => {
    const url = await runAction(
      addInvoicePayment("neexistuje", paymentForm({ amount: "100" })),
    );

    expect(url).toBe("/invoices?error=notfound");
  });

  it("dvě souběžné úhrady na celý zbytek fakturu nepřeplatí", async () => {
    await createInvoice({ total: "10000.00" });

    const results = await Promise.allSettled([
      addInvoicePayment("test-invoice", paymentForm({ amount: "10000" })),
      addInvoicePayment("test-invoice", paymentForm({ amount: "10000" })),
    ]);
    const invoice = await readInvoice();

    // Obě volání skončí výjimkou (přesměrováním), rozhoduje stav v databázi.
    expect(results).toHaveLength(2);
    expect(invoice.payments).toEqual(["10000"]);
    expect(invoice.paidAmount).toBe("10000");
    expect(invoice.status).toBe(InvoiceStatus.PAID);
  });
});

describe("deleteInvoicePayment", () => {
  it("smazání poslední platby vrátí doklad mezi nezaplacené", async () => {
    await createInvoice({
      payments: [{ amount: "10000.00", paidOn: new Date("2026-09-10") }],
      status: InvoiceStatus.PAID,
      total: "10000.00",
    });
    const payment = await prisma.invoicePayment.findFirstOrThrow();

    const url = await runAction(deleteInvoicePayment(payment.id));
    const invoice = await readInvoice();

    expect(url).toBe("/invoices/test-invoice?payment=removed");
    expect(invoice.status).toBe(InvoiceStatus.ISSUED);
    expect(invoice.paidAmount).toBe("0");
    expect(invoice.paidAt).toBeNull();
  });

  it("smazání jedné z více plateb přepočítá uhrazenou částku", async () => {
    await createInvoice({
      payments: [
        { amount: "3000.00", paidOn: new Date("2026-09-05") },
        { amount: "7000.00", paidOn: new Date("2026-09-10") },
      ],
      status: InvoiceStatus.PAID,
      total: "10000.00",
    });
    const payment = await prisma.invoicePayment.findFirstOrThrow({
      where: { amount: "7000" },
    });

    await runAction(deleteInvoicePayment(payment.id));
    const invoice = await readInvoice();

    expect(invoice.status).toBe(InvoiceStatus.ISSUED);
    expect(invoice.paidAmount).toBe("3000");
    expect(invoice.payments).toEqual(["3000"]);
  });
});

describe("markInvoicePaid", () => {
  it("doplatí zbývající částku jedinou platbou", async () => {
    await createInvoice({
      payments: [{ amount: "4000.00", paidOn: new Date("2026-09-10") }],
      total: "10000.00",
    });

    const url = await runAction(markInvoicePaid("test-invoice"));
    const invoice = await readInvoice();

    expect(url).toBe("/invoices/test-invoice?paid=1");
    expect(invoice.status).toBe(InvoiceStatus.PAID);
    expect(invoice.payments).toEqual(["4000", "6000"]);
  });

  it("na už zaplacený doklad další platbu nepřidá", async () => {
    await createInvoice({
      payments: [{ amount: "10000.00", paidOn: new Date("2026-09-10") }],
      status: InvoiceStatus.PAID,
      total: "10000.00",
    });

    await runAction(markInvoicePaid("test-invoice"));

    expect((await readInvoice()).payments).toEqual(["10000"]);
  });

  it("stornovaný doklad označit jako zaplacený nejde", async () => {
    await createInvoice({ status: InvoiceStatus.CANCELLED });

    const url = await runAction(markInvoicePaid("test-invoice"));

    expect(url).toBe("/invoices/test-invoice?error=readonly");
    expect((await readInvoice()).payments).toEqual([]);
  });
});

describe("updateInvoice", () => {
  it("fakturu s evidovanou úhradou upravit nejde", async () => {
    await createInvoice({
      payments: [{ amount: "1000.00", paidOn: new Date("2026-09-10") }],
      total: "10000.00",
    });

    const url = await runAction(updateInvoice("test-invoice", new FormData()));

    expect(url).toBe("/invoices/test-invoice/edit?error=paidlock");
  });
});

describe("cancelInvoice", () => {
  it("bez úhrady doklad prostě stornuje", async () => {
    await createInvoice({ total: "10000.00" });

    const url = await runAction(cancelInvoice("test-invoice"));
    const invoice = await readInvoice();

    expect(url).toBe("/invoices/test-invoice?cancelled=1");
    expect(invoice.status).toBe(InvoiceStatus.CANCELLED);
    expect(invoice.payments).toEqual([]);
  });

  it("s ponechanými penězi zachová platbu i uhrazenou částku", async () => {
    await createInvoice({
      payments: [{ amount: "10000.00", paidOn: new Date("2026-09-10") }],
      status: InvoiceStatus.PAID,
      total: "10000.00",
    });

    const url = await runAction(
      cancelInvoice("test-invoice", paymentForm({ refund: "0" })),
    );
    const invoice = await readInvoice();

    expect(url).toBe("/invoices/test-invoice?cancelled=1");
    expect(invoice.status).toBe(InvoiceStatus.CANCELLED);
    expect(invoice.paidAt).toBeNull();
    expect(invoice.payments).toEqual(["10000"]);
    expect(invoice.paidAmount).toBe("10000");
  });

  it("s vrácením peněz zapíše zápornou platbu a vynuluje uhrazenou částku", async () => {
    await createInvoice({
      payments: [{ amount: "10000.00", paidOn: new Date("2026-09-10") }],
      status: InvoiceStatus.PAID,
      total: "10000.00",
    });

    const url = await runAction(
      cancelInvoice("test-invoice", paymentForm({ refund: "1" })),
    );
    const invoice = await readInvoice();

    expect(url).toBe("/invoices/test-invoice?cancelled=refunded");
    expect(invoice.status).toBe(InvoiceStatus.CANCELLED);
    expect(invoice.payments).toEqual(["10000", "-10000"]);
    // Historie plateb zůstává, netto je ale nula — peníze odešly zpátky.
    expect(invoice.paidAmount).toBe("0");
  });

  it("vrácení částečné úhrady odečte přesně přijatou částku", async () => {
    await createInvoice({
      payments: [
        { amount: "3000.00", paidOn: new Date("2026-09-05") },
        { amount: "1000.00", paidOn: new Date("2026-09-08") },
      ],
      total: "10000.00",
    });

    await runAction(cancelInvoice("test-invoice", paymentForm({ refund: "1" })));
    const invoice = await readInvoice();

    expect(invoice.payments).toEqual(["3000", "1000", "-4000"]);
    expect(invoice.paidAmount).toBe("0");
  });

  it("volba vrácení u faktury bez úhrady žádnou zápornou platbu nezaloží", async () => {
    await createInvoice({ total: "10000.00" });

    const url = await runAction(
      cancelInvoice("test-invoice", paymentForm({ refund: "1" })),
    );

    expect(url).toBe("/invoices/test-invoice?cancelled=1");
    expect((await readInvoice()).payments).toEqual([]);
  });

  it("opakované storno stav nemění a nepřidá druhé vrácení", async () => {
    await createInvoice({
      payments: [{ amount: "10000.00", paidOn: new Date("2026-09-10") }],
      status: InvoiceStatus.PAID,
      total: "10000.00",
    });

    await runAction(cancelInvoice("test-invoice", paymentForm({ refund: "1" })));
    await runAction(cancelInvoice("test-invoice", paymentForm({ refund: "1" })));
    const invoice = await readInvoice();

    expect(invoice.payments).toEqual(["10000", "-10000"]);
  });

  it("neexistující doklad hlásí, že nebyl nalezen, ne chybu databáze", async () => {
    const url = await runAction(cancelInvoice("neexistuje"));

    expect(url).toBe("/invoices?error=notfound");
  });
});

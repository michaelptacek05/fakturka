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

const { importInvoices } = await import("@/app/(app)/import/actions");
const { prisma } = await import("@/lib/prisma");
const { buildSpaydPayload, sanitizeSpaydPayload } = await import("@/lib/spayd");
const { decodeQr, readSpaydField } = await import("../qr-decode");
const { resetDatabase } = await import("./factory");

async function runImport(variableSymbol: string | null, number = "2026-0001") {
  const formData = new FormData();

  formData.set(
    "payload",
    JSON.stringify([
      {
        client: { name: "Testovací odběratel s.r.o." },
        currency: "CZK",
        dueDate: "2026-09-30",
        issueDate: "2026-09-01",
        items: [
          { name: "Konzultace", quantity: 1, unit: "h", unitPrice: 12100.5, vatRate: 0 },
        ],
        notes: null,
        number,
        paidAmount: null,
        paidAt: null,
        reportedTotal: null,
        status: "ISSUED",
        taxableSupplyDate: null,
        variableSymbol,
      },
    ]),
  );

  try {
    await importInvoices(formData);
  } catch (error) {
    if (!(error instanceof RedirectSignal)) {
      throw error;
    }
  }

  return prisma.invoice.findFirstOrThrow({
    include: { profile: true },
    where: { number },
  });
}

/** Složí payload přesně tak, jak ho appka staví na faktuře i v PDF. */
function buildInvoicePayload(invoice: Awaited<ReturnType<typeof runImport>>) {
  return sanitizeSpaydPayload(
    buildSpaydPayload({
      accountNumber: invoice.profile.accountNumber,
      amount: invoice.total,
      bankCode: invoice.profile.bankCode,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      iban: invoice.profile.iban,
      includeBic: false,
      message: `Faktura ${invoice.number}`,
      swift: invoice.profile.swift,
      variableSymbol: invoice.variableSymbol,
    }),
  );
}

describe("variabilní symbol z importu", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("uloží dlouhý symbol zkrácený na deset číslic", async () => {
    const invoice = await runImport("20260001234567");

    expect(invoice.variableSymbol).toBe("0001234567");
  });

  it("krátký symbol nechá beze změny", async () => {
    const invoice = await runImport("12345678");

    expect(invoice.variableSymbol).toBe("12345678");
  });

  it("chybějící symbol odvodí z čísla faktury", async () => {
    const invoice = await runImport(null);

    expect(invoice.variableSymbol).toBe("20260001");
  });
});

describe("QR platba nad naimportovanou fakturou", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("čtečka přečte stejný symbol, jaký je na faktuře vytištěný", async () => {
    const invoice = await runImport("20260001234567");
    const payload = buildInvoicePayload(invoice);
    const decoded = decodeQr(payload, 8);

    expect(decoded).toBe(payload);
    // Tohle je jádro věci: co je v databázi a na tisku, to musí přečíst banka.
    expect(readSpaydField(decoded!, "X-VS")).toBe(invoice.variableSymbol);
    expect(invoice.variableSymbol).toHaveLength(10);
  });

  it("QR nese doplatek, účet z profilu a splatnost faktury", async () => {
    const invoice = await runImport("12345678");
    const decoded = decodeQr(buildInvoicePayload(invoice), 8);

    expect(readSpaydField(decoded!, "ACC")).toBe("CZ7908000000002000145399");
    expect(readSpaydField(decoded!, "AM")).toBe("12100.50");
    expect(readSpaydField(decoded!, "CC")).toBe("CZK");
    expect(readSpaydField(decoded!, "DT")).toBe("20260930");
    expect(readSpaydField(decoded!, "X-VS")).toBe("12345678");
  });
});

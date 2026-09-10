import { describe, expect, it } from "vitest";

import { InvoiceStatus } from "@/generated/prisma/enums";
import { buildDashboardData } from "@/lib/dashboard";
import { fromCents, sumPaymentsCents } from "@/lib/invoice-payment";

/** Polovina června, ať má měsíc, kvartál i rok jinou hranici. */
const today = new Date(2026, 5, 15);

type Payment = { amount: number | string; paidOn: Date };

type InvoiceOverrides = {
  dueDate?: Date;
  id?: string;
  issueDate?: Date;
  number?: string;
  paidAmount?: number | string;
  payments?: Payment[];
  status?: InvoiceStatus;
  taxableSupplyDate?: Date | null;
  total?: number | string;
};

/**
 * `paidAmount` je v databázi jen cache součtu plateb, takže ho testy dopočítávají
 * stejně jako doména — jinak by měřily stav, který v aplikaci nemůže nastat.
 */
function createInvoice(overrides: InvoiceOverrides = {}) {
  const payments = overrides.payments ?? [];

  return {
    clientName: "Odběratel s.r.o.",
    dueDate: overrides.dueDate ?? new Date(2026, 6, 15),
    id: overrides.id ?? "invoice-1",
    issueDate: overrides.issueDate ?? new Date(2026, 5, 1),
    number: overrides.number ?? "2026001",
    paidAmount: overrides.paidAmount ?? fromCents(sumPaymentsCents(payments)),
    payments,
    status: overrides.status ?? InvoiceStatus.ISSUED,
    taxableSupplyDate: overrides.taxableSupplyDate ?? null,
    total: overrides.total ?? 10_000,
  };
}

function getMonthTotal(
  dashboard: ReturnType<typeof buildDashboardData>,
  key: string,
) {
  return dashboard.monthlyRevenue.find((month) => month.key === key)?.total;
}

describe("příjmy z plateb", () => {
  it("plně zaplacená faktura se projeví v měsíci platby", () => {
    const dashboard = buildDashboardData(
      [
        createInvoice({
          payments: [{ amount: 10_000, paidOn: new Date(2026, 5, 10) }],
          status: InvoiceStatus.PAID,
          total: 10_000,
        }),
      ],
      today,
    );

    expect(dashboard.metrics.month.total).toBe(10_000);
    expect(dashboard.metrics.month.count).toBe(1);
    expect(getMonthTotal(dashboard, "2026-06")).toBe(10_000);
    expect(dashboard.metrics.unpaid.total).toBe(0);
    expect(dashboard.metrics.unpaid.count).toBe(0);
  });

  it("částečná úhrada se započítá jen zaplacenou částí a zbytek zůstane nezaplacený", () => {
    const dashboard = buildDashboardData(
      [
        createInvoice({
          payments: [{ amount: 4_000, paidOn: new Date(2026, 5, 10) }],
          total: 10_000,
        }),
      ],
      today,
    );

    expect(dashboard.metrics.month.total).toBe(4_000);
    expect(dashboard.metrics.month.count).toBe(1);
    expect(dashboard.metrics.unpaid.total).toBe(6_000);
    expect(dashboard.metrics.unpaid.count).toBe(1);
    expect(dashboard.recentInvoices[0].visualState).toBe("partial");
  });

  it("dvě platby na jedné faktuře se rozpadnou mezi měsíce", () => {
    const dashboard = buildDashboardData(
      [
        createInvoice({
          issueDate: new Date(2026, 4, 1),
          payments: [
            { amount: 3_000, paidOn: new Date(2026, 4, 20) },
            { amount: 7_000, paidOn: new Date(2026, 5, 5) },
          ],
          status: InvoiceStatus.PAID,
          total: 10_000,
        }),
      ],
      today,
    );

    expect(getMonthTotal(dashboard, "2026-05")).toBe(3_000);
    expect(getMonthTotal(dashboard, "2026-06")).toBe(7_000);
    expect(dashboard.metrics.month.total).toBe(7_000);
    // Kvartál i rok mají obě platby, ale pořád jde o jednu fakturu.
    expect(dashboard.metrics.quarter.total).toBe(10_000);
    expect(dashboard.metrics.year.total).toBe(10_000);
    expect(dashboard.metrics.year.count).toBe(1);
  });

  it("storno s ponechanými penězi je nechá v příjmech", () => {
    const dashboard = buildDashboardData(
      [
        createInvoice({
          payments: [{ amount: 5_000, paidOn: new Date(2026, 5, 2) }],
          status: InvoiceStatus.CANCELLED,
          total: 5_000,
        }),
      ],
      today,
    );

    // Storno ruší doklad, ne pohyb peněz — přijatá částka je pořád příjem.
    expect(dashboard.metrics.month.total).toBe(5_000);
    expect(dashboard.metrics.year.total).toBe(5_000);
    // Pohledávka ale zaniká a do obratu pro DPH stornovaný doklad nepatří.
    expect(dashboard.metrics.unpaid.total).toBe(0);
    expect(dashboard.metrics.vatLimit.total).toBe(0);
  });

  it("vrácení úhrady při stornu příjmy vynuluje", () => {
    const dashboard = buildDashboardData(
      [
        createInvoice({
          payments: [
            { amount: 5_000, paidOn: new Date(2026, 5, 2) },
            { amount: -5_000, paidOn: new Date(2026, 5, 10) },
          ],
          status: InvoiceStatus.CANCELLED,
          total: 5_000,
        }),
      ],
      today,
    );

    expect(dashboard.metrics.month.total).toBe(0);
    expect(dashboard.metrics.year.total).toBe(0);
    // Doklad, kde se peníze vrátily hned, se do počtu faktur s úhradou nepočítá.
    expect(dashboard.metrics.month.count).toBe(0);
  });

  it("vrácení v jiném měsíci se odečte tam, kde peníze odešly", () => {
    const dashboard = buildDashboardData(
      [
        createInvoice({
          payments: [
            { amount: 5_000, paidOn: new Date(2026, 4, 20) },
            { amount: -5_000, paidOn: new Date(2026, 5, 10) },
          ],
          status: InvoiceStatus.CANCELLED,
          total: 5_000,
        }),
      ],
      today,
    );

    expect(getMonthTotal(dashboard, "2026-05")).toBe(5_000);
    expect(getMonthTotal(dashboard, "2026-06")).toBe(-5_000);
    // Za celý rok se to potká na nule.
    expect(dashboard.metrics.year.total).toBe(0);
  });

  it("sčítá v haléřích, takže se splátky potkají s celkovou částkou", () => {
    const dashboard = buildDashboardData(
      [
        createInvoice({
          payments: [
            { amount: 33.33, paidOn: new Date(2026, 5, 1) },
            { amount: 33.33, paidOn: new Date(2026, 5, 2) },
            { amount: 33.34, paidOn: new Date(2026, 5, 3) },
          ],
          status: InvoiceStatus.PAID,
          total: 100,
        }),
      ],
      today,
    );

    expect(dashboard.metrics.month.total).toBe(100);
    expect(dashboard.metrics.unpaid.total).toBe(0);
  });
});

describe("nezaplacené a po splatnosti", () => {
  it("po splatnosti se počítá zbývající částka, ne celý doklad", () => {
    const dashboard = buildDashboardData(
      [
        createInvoice({
          dueDate: new Date(2026, 4, 1),
          issueDate: new Date(2026, 3, 1),
          payments: [{ amount: 2_000, paidOn: new Date(2026, 4, 10) }],
          total: 10_000,
        }),
      ],
      today,
    );

    expect(dashboard.metrics.overdue.total).toBe(8_000);
    expect(dashboard.metrics.overdue.count).toBe(1);
    expect(dashboard.metrics.unpaid.total).toBe(8_000);
    expect(dashboard.recentInvoices[0].visualState).toBe("overdue");
  });

  it("koncept ani zaplacená faktura mezi nezaplacené nepatří", () => {
    const dashboard = buildDashboardData(
      [
        createInvoice({ id: "draft", status: InvoiceStatus.DRAFT }),
        createInvoice({
          id: "paid",
          payments: [{ amount: 10_000, paidOn: new Date(2026, 5, 4) }],
          status: InvoiceStatus.PAID,
        }),
      ],
      today,
    );

    expect(dashboard.metrics.unpaid.count).toBe(0);
    expect(dashboard.metrics.unpaid.total).toBe(0);
  });
});

describe("obrat a odvody", () => {
  it("limit DPH bere celou částku faktury, i když ještě není zaplacená", () => {
    const dashboard = buildDashboardData(
      [createInvoice({ total: 250_000 })],
      today,
    );

    // Obrat je vystavená částka, cash flow je nula — dvě různá čísla.
    expect(dashboard.metrics.vatLimit.total).toBe(250_000);
    expect(dashboard.metrics.vatLimit.remaining).toBe(1_750_000);
    expect(dashboard.metrics.month.total).toBe(0);
  });

  it("odhad odvodů počítá jen s letos přijatými platbami", () => {
    const dashboard = buildDashboardData(
      [
        createInvoice({
          payments: [{ amount: 120_000, paidOn: new Date(2026, 2, 10) }],
          total: 500_000,
        }),
        createInvoice({
          id: "invoice-2",
          issueDate: new Date(2025, 10, 1),
          number: "2025010",
          payments: [{ amount: 80_000, paidOn: new Date(2025, 11, 20) }],
          status: InvoiceStatus.PAID,
          total: 80_000,
        }),
      ],
      today,
    );

    expect(dashboard.metrics.year.total).toBe(120_000);
    expect(dashboard.estimate.revenue).toBe(120_000);
  });
});

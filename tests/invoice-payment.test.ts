import { describe, expect, it } from "vitest";

import { InvoiceStatus } from "@/generated/prisma/enums";
import {
  fromCents,
  getInvoiceVisualState,
  getPaymentSummary,
  isOutstanding,
  type MoneyLike,
  type PayableInvoice,
  type PaymentRecord,
  resolvePaymentState,
  sumPaymentsCents,
  toCents,
} from "@/lib/invoice-payment";

/** Pevné „dnes", ať jsou testy nezávislé na skutečném datu. */
const dnes = new Date("2026-03-15T10:30:00");
const vcera = new Date("2026-03-14T00:00:00");
const dnesPulnoc = new Date("2026-03-15T00:00:00");
const zitra = new Date("2026-03-16T00:00:00");

/** Napodobuje Prisma Decimal — do knihovny chodí objekt, ne číslo. */
function decimal(value: string) {
  return { toString: () => value };
}

function faktura(overrides: Partial<PayableInvoice> = {}): PayableInvoice {
  return {
    dueDate: zitra,
    paidAmount: "0.00",
    status: InvoiceStatus.ISSUED,
    total: "1000.00",
    ...overrides,
  };
}

function platba(amount: MoneyLike, den: string): PaymentRecord {
  return { amount, paidOn: new Date(`${den}T00:00:00`) };
}

describe("toCents", () => {
  it("převede řetězec z Decimalu, číslo i objekt s toString()", () => {
    expect(toCents("1234.56")).toBe(123_456);
    expect(toCents(1234.56)).toBe(123_456);
    expect(toCents(decimal("1234.56"))).toBe(123_456);
  });

  it("zaokrouhluje na celé haléře", () => {
    expect(toCents("10")).toBe(1000);
    expect(toCents("10.1")).toBe(1010);
    expect(toCents("0.005")).toBe(1);
    expect(toCents("-50.25")).toBe(-5025);
  });

  it("nepodléhá nepřesnostem plovoucí čárky", () => {
    // 0.1 + 0.2 je ve floatu 0.30000000000000004.
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents("33.33")).toBe(3333);
    expect(toCents("99.99")).toBe(9999);
  });

  it("z nevalidního vstupu udělá nulu", () => {
    expect(toCents("abc")).toBe(0);
    expect(toCents(Number.NaN)).toBe(0);
    expect(toCents(decimal("není číslo"))).toBe(0);
    expect(toCents(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("fromCents", () => {
  it("vrací korunovou částku", () => {
    expect(fromCents(123_456)).toBe(1234.56);
    expect(fromCents(0)).toBe(0);
    expect(fromCents(-5025)).toBe(-50.25);
  });

  it("je opakem toCents", () => {
    for (const castka of ["0.00", "33.33", "99.99", "1234.56", "1000.00"]) {
      expect(fromCents(toCents(castka)).toFixed(2)).toBe(castka);
    }
  });
});

describe("sumPaymentsCents", () => {
  it("prázdný seznam plateb je nula", () => {
    expect(sumPaymentsCents([])).toBe(0);
  });

  it("tři platby po 33.33 se přesně potkají s 99.99", () => {
    const platby = [
      platba("33.33", "2026-03-01"),
      platba("33.33", "2026-03-02"),
      platba("33.33", "2026-03-03"),
    ];

    // Ve floatu by 33.33 * 3 bylo 99.99000000000001, v haléřích sedí přesně.
    expect(sumPaymentsCents(platby)).toBe(9999);
    expect(sumPaymentsCents(platby)).toBe(toCents("99.99"));
    expect(fromCents(sumPaymentsCents(platby)).toFixed(2)).toBe("99.99");
  });

  it("sečte Decimaly, čísla i řetězce dohromady", () => {
    const platby = [
      platba(decimal("500.00"), "2026-03-01"),
      platba(250.5, "2026-03-02"),
      platba("249.50", "2026-03-03"),
    ];

    expect(sumPaymentsCents(platby)).toBe(100_000);
  });

  it("nevalidní částku počítá jako nulu", () => {
    const platby = [platba("100.00", "2026-03-01"), platba("abc", "2026-03-02")];

    expect(sumPaymentsCents(platby)).toBe(10_000);
  });
});

describe("getPaymentSummary", () => {
  it("nezaplacená faktura nemá uhrazeno nic", () => {
    const summary = getPaymentSummary({ paidAmount: "0.00", total: "1000.00" });

    expect(summary.paidCents).toBe(0);
    expect(summary.totalCents).toBe(100_000);
    expect(summary.remainingCents).toBe(100_000);
    expect(summary.isPartiallyPaid).toBe(false);
    expect(summary.isFullyPaid).toBe(false);
  });

  it("částečná úhrada hlásí zbytek k doplacení", () => {
    const summary = getPaymentSummary({
      paidAmount: decimal("300.00"),
      total: decimal("1000.00"),
    });

    expect(summary.paidCents).toBe(30_000);
    expect(summary.remainingCents).toBe(70_000);
    expect(summary.isPartiallyPaid).toBe(true);
    expect(summary.isFullyPaid).toBe(false);
  });

  it("zaplaceno přesně na korunu je už plná úhrada", () => {
    const summary = getPaymentSummary({
      paidAmount: "1000.00",
      total: "1000.00",
    });

    expect(summary.remainingCents).toBe(0);
    expect(summary.isFullyPaid).toBe(true);
    expect(summary.isPartiallyPaid).toBe(false);
  });

  it("haléř pod celkovou částkou je pořád jen částečná úhrada", () => {
    const summary = getPaymentSummary({
      paidAmount: "999.99",
      total: "1000.00",
    });

    expect(summary.remainingCents).toBe(1);
    expect(summary.isFullyPaid).toBe(false);
    expect(summary.isPartiallyPaid).toBe(true);
  });

  it("přeplatek nevyrobí zápornou zbývající částku", () => {
    const summary = getPaymentSummary({
      paidAmount: "1500.00",
      total: "1000.00",
    });

    expect(summary.paidCents).toBe(150_000);
    expect(summary.remainingCents).toBe(0);
    expect(summary.remainingCents).toBeGreaterThanOrEqual(0);
    expect(summary.isFullyPaid).toBe(true);
    expect(summary.isPartiallyPaid).toBe(false);
  });

  it("faktura na nula korun je vyrovnaná z definice", () => {
    const summary = getPaymentSummary({ paidAmount: "0.00", total: "0.00" });

    expect(summary.totalCents).toBe(0);
    expect(summary.remainingCents).toBe(0);
    expect(summary.isFullyPaid).toBe(true);
    expect(summary.isPartiallyPaid).toBe(false);
  });

  it("platba na nulovou fakturu je přeplatek, ne částečná úhrada", () => {
    const summary = getPaymentSummary({ paidAmount: "100.00", total: "0.00" });

    expect(summary.paidCents).toBe(10_000);
    expect(summary.remainingCents).toBe(0);
    expect(summary.isFullyPaid).toBe(true);
    expect(summary.isPartiallyPaid).toBe(false);
  });
});

describe("resolvePaymentState", () => {
  it("bez platby zůstává doklad vystavený a nezaplacený", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.ISSUED,
      payments: [],
      total: "1000.00",
    });

    expect(state.status).toBe(InvoiceStatus.ISSUED);
    expect(state.paidAt).toBeNull();
    expect(state.paidAmount).toBe("0.00");
  });

  it("částečná úhrada nechává doklad vystavený a bez data úhrady", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.ISSUED,
      payments: [platba("300.00", "2026-03-01")],
      total: "1000.00",
    });

    expect(state.status).toBe(InvoiceStatus.ISSUED);
    expect(state.paidAt).toBeNull();
    expect(state.paidAmount).toBe("300.00");
  });

  it("doplacení do plné výše překlopí doklad na uhrazený", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.ISSUED,
      payments: [
        platba("300.00", "2026-03-01"),
        platba("700.00", "2026-03-05"),
      ],
      total: "1000.00",
    });

    expect(state.status).toBe(InvoiceStatus.PAID);
    expect(state.paidAmount).toBe("1000.00");
    expect(state.paidAt).toEqual(new Date("2026-03-05T00:00:00"));
  });

  it("datum úhrady je datum poslední platby, ne dnešek", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.ISSUED,
      payments: [platba("1000.00", "2020-01-31")],
      total: "1000.00",
    });

    expect(state.paidAt).toEqual(new Date("2020-01-31T00:00:00"));
    expect(state.paidAt?.getTime()).toBeLessThan(dnes.getTime());
  });

  it("bere maximum z plateb i v náhodném pořadí", () => {
    const platby = [
      platba("200.00", "2026-03-09"),
      platba("500.00", "2026-03-02"),
      platba("300.00", "2026-03-07"),
    ];

    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.ISSUED,
      payments: platby,
      total: "1000.00",
    });

    expect(state.paidAt).toEqual(new Date("2026-03-09T00:00:00"));

    const obracene = resolvePaymentState({
      currentStatus: InvoiceStatus.ISSUED,
      payments: [...platby].reverse(),
      total: "1000.00",
    });

    expect(obracene.paidAt).toEqual(state.paidAt);
  });

  it("součet plateb se s celkovou částkou potká i po zaokrouhlení", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.ISSUED,
      payments: [
        platba("33.33", "2026-03-01"),
        platba("33.33", "2026-03-02"),
        platba("33.33", "2026-03-03"),
      ],
      total: decimal("99.99"),
    });

    expect(state.paidAmount).toBe("99.99");
    expect(state.status).toBe(InvoiceStatus.PAID);
  });

  it("přeplatek doklad taky uhradí", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.ISSUED,
      payments: [platba("1500.00", "2026-03-04")],
      total: "1000.00",
    });

    expect(state.status).toBe(InvoiceStatus.PAID);
    expect(state.paidAmount).toBe("1500.00");
    expect(state.paidAt).toEqual(new Date("2026-03-04T00:00:00"));
  });

  it("koncept zůstane konceptem i s částečnou úhradou", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.DRAFT,
      payments: [platba("300.00", "2026-03-01")],
      total: "1000.00",
    });

    expect(state.status).toBe(InvoiceStatus.DRAFT);
    expect(state.paidAt).toBeNull();
    expect(state.paidAmount).toBe("300.00");
  });

  // Pozorované chování: plná úhrada překlopí i koncept rovnou na PAID,
  // ochrana konceptu platí jen pro nedoplacené doklady.
  it("koncept s plnou úhradou se přesto překlopí na uhrazený", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.DRAFT,
      payments: [platba("1000.00", "2026-03-01")],
      total: "1000.00",
    });

    expect(state.status).toBe(InvoiceStatus.PAID);
    expect(state.paidAt).toEqual(new Date("2026-03-01T00:00:00"));
  });

  it("stornovaný doklad zůstane stornovaný a bez data úhrady i s platbami", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.CANCELLED,
      payments: [
        platba("500.00", "2026-03-01"),
        platba("500.00", "2026-03-02"),
      ],
      total: "1000.00",
    });

    expect(state.status).toBe(InvoiceStatus.CANCELLED);
    expect(state.paidAt).toBeNull();
    expect(state.paidAmount).toBe("1000.00");
  });

  it("doklad po splatnosti se s částečnou platbou vrací jako vystavený", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.OVERDUE,
      payments: [platba("100.00", "2026-03-01")],
      total: "1000.00",
    });

    expect(state.status).toBe(InvoiceStatus.ISSUED);
  });

  it("vystavená faktura na nula korun je rovnou zaplacená", () => {
    const state = resolvePaymentState({
      currentStatus: InvoiceStatus.ISSUED,
      payments: [],
      total: "0.00",
    });

    expect(state.status).toBe(InvoiceStatus.PAID);
    expect(state.paidAmount).toBe("0.00");
  });

  it("uhrazená částka je vždy řetězec na dvě desetinná místa", () => {
    const varianty: Array<[MoneyLike, string]> = [
      ["1000", "1000.00"],
      ["0.1", "0.10"],
      [0.1 + 0.2, "0.30"],
      [decimal("12.5"), "12.50"],
    ];

    for (const [castka, ocekavano] of varianty) {
      const state = resolvePaymentState({
        currentStatus: InvoiceStatus.ISSUED,
        payments: [platba(castka, "2026-03-01")],
        total: "100000.00",
      });

      expect(state.paidAmount).toBe(ocekavano);
    }
  });
});

describe("getInvoiceVisualState", () => {
  it("storno má přednost před vším ostatním", () => {
    const stornoPoSplatnosti = faktura({
      dueDate: vcera,
      paidAmount: "0.00",
      status: InvoiceStatus.CANCELLED,
    });
    const stornoUhrazene = faktura({
      paidAmount: "1000.00",
      status: InvoiceStatus.CANCELLED,
    });

    expect(getInvoiceVisualState(stornoPoSplatnosti, dnes)).toBe("cancelled");
    expect(getInvoiceVisualState(stornoUhrazene, dnes)).toBe("cancelled");
  });

  it("plně uhrazený doklad je zaplacený podle stavu i podle částky", () => {
    const podleStavu = faktura({
      paidAmount: "1000.00",
      status: InvoiceStatus.PAID,
    });
    const podleCastky = faktura({
      paidAmount: decimal("1000.00"),
      status: InvoiceStatus.ISSUED,
    });
    const prepatek = faktura({ paidAmount: "1500.00" });

    expect(getInvoiceVisualState(podleStavu, dnes)).toBe("paid");
    expect(getInvoiceVisualState(podleCastky, dnes)).toBe("paid");
    expect(getInvoiceVisualState(prepatek, dnes)).toBe("paid");
  });

  it("uhrazený doklad je zaplacený, i když je po splatnosti", () => {
    const invoice = faktura({ dueDate: vcera, paidAmount: "1000.00" });

    expect(getInvoiceVisualState(invoice, dnes)).toBe("paid");
  });

  it("částečná úhrada před splatností je částečně uhrazeno", () => {
    const invoice = faktura({ dueDate: zitra, paidAmount: "300.00" });

    expect(getInvoiceVisualState(invoice, dnes)).toBe("partial");
  });

  it("částečná úhrada po splatnosti je po splatnosti", () => {
    const invoice = faktura({ dueDate: vcera, paidAmount: "300.00" });

    expect(getInvoiceVisualState(invoice, dnes)).toBe("overdue");
  });

  it("nezaplacený doklad je před splatností neuhrazený, po splatnosti po splatnosti", () => {
    expect(getInvoiceVisualState(faktura({ dueDate: zitra }), dnes)).toBe(
      "unpaid",
    );
    expect(getInvoiceVisualState(faktura({ dueDate: vcera }), dnes)).toBe(
      "overdue",
    );
  });

  it("splatnost dnes ještě není po splatnosti", () => {
    const dnesRano = faktura({ dueDate: dnesPulnoc });
    const dnesVecer = faktura({ dueDate: new Date("2026-03-15T23:59:59") });
    const castecneDnes = faktura({
      dueDate: dnesPulnoc,
      paidAmount: "300.00",
    });

    expect(getInvoiceVisualState(dnesRano, dnes)).toBe("unpaid");
    expect(getInvoiceVisualState(dnesVecer, dnes)).toBe("unpaid");
    expect(getInvoiceVisualState(castecneDnes, dnes)).toBe("partial");

    // Až následující den se z téhož dokladu stane doklad po splatnosti.
    const zitraRano = new Date("2026-03-16T00:01:00");

    expect(getInvoiceVisualState(dnesRano, zitraRano)).toBe("overdue");
  });

  it("koncept je bez příznaku", () => {
    const koncept = faktura({ status: InvoiceStatus.DRAFT });
    const konceptPoSplatnosti = faktura({
      dueDate: vcera,
      status: InvoiceStatus.DRAFT,
    });
    const konceptCastecne = faktura({
      paidAmount: "300.00",
      status: InvoiceStatus.DRAFT,
    });

    expect(getInvoiceVisualState(koncept, dnes)).toBe("default");
    expect(getInvoiceVisualState(konceptPoSplatnosti, dnes)).toBe("default");
    expect(getInvoiceVisualState(konceptCastecne, dnes)).toBe("default");
  });

  // O štítku rozhoduje stav dokladu dřív než částka, jinak by koncept
  // s vyplněnou úhradou vypadal jako hotová věc.
  it("koncept zůstává konceptem i s plně uhrazenou částkou", () => {
    const invoice = faktura({
      paidAmount: "1000.00",
      status: InvoiceStatus.DRAFT,
    });

    expect(getInvoiceVisualState(invoice, dnes)).toBe("default");
  });

  it("doklad se stavem OVERDUE se chová jako vystavený po splatnosti", () => {
    const invoice = faktura({
      dueDate: vcera,
      status: InvoiceStatus.OVERDUE,
    });

    expect(getInvoiceVisualState(invoice, dnes)).toBe("overdue");
  });

  it("bez parametru today se počítá vůči dnešku", () => {
    const davnoPoSplatnosti = faktura({ dueDate: new Date("2020-01-01") });

    expect(getInvoiceVisualState(davnoPoSplatnosti)).toBe("overdue");
  });
});

describe("isOutstanding", () => {
  it("vystavená faktura se zbytkem se inkasuje", () => {
    expect(isOutstanding(faktura())).toBe(true);
  });

  it("částečně uhrazená faktura se pořád inkasuje", () => {
    expect(isOutstanding(faktura({ paidAmount: "999.99" }))).toBe(true);
  });

  it("doklad po splatnosti se taky inkasuje", () => {
    const invoice = faktura({ dueDate: vcera, status: InvoiceStatus.OVERDUE });

    expect(isOutstanding(invoice)).toBe(true);
  });

  it("koncept, uhrazený ani stornovaný doklad se neinkasují", () => {
    expect(isOutstanding(faktura({ status: InvoiceStatus.DRAFT }))).toBe(false);
    expect(
      isOutstanding(
        faktura({ paidAmount: "1000.00", status: InvoiceStatus.PAID }),
      ),
    ).toBe(false);
    expect(
      isOutstanding(
        faktura({ paidAmount: "500.00", status: InvoiceStatus.CANCELLED }),
      ),
    ).toBe(false);
  });

  it("doklad bez zbytku se neinkasuje", () => {
    expect(isOutstanding(faktura({ paidAmount: "1000.00" }))).toBe(false);
    expect(isOutstanding(faktura({ paidAmount: "1500.00" }))).toBe(false);
    expect(isOutstanding(faktura({ paidAmount: "0.00", total: "0.00" }))).toBe(
      false,
    );
  });
});

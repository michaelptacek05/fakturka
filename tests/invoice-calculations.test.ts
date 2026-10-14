import { describe, expect, it } from "vitest";
import {
  calculateInvoiceLine,
  formatQuantity,
  moneyToCents,
  sumInvoiceLines,
} from "@/lib/invoice-calculations";
import { normalizeQuantity, ValidationError } from "@/lib/validation";
import { previewInvoiceImport } from "@/lib/fakturoid-import";

describe("přesné položky faktury", () => {
  it("polovinu 29 haléřů zaokrouhlí na 15 haléřů", () => {
    expect(calculateInvoiceLine({ quantity: "0.5", unitPriceCents: 29, vatRate: 0 }))
      .toEqual({ lineSubtotalCents: 15, lineVatCents: 0, lineTotalCents: 15 });
  });

  it("DPH zaokrouhlí z již zaokrouhleného základu každé položky", () => {
    const line = calculateInvoiceLine({ quantity: "0.5", unitPriceCents: 29, vatRate: 21 });
    expect(line).toEqual({ lineSubtotalCents: 15, lineVatCents: 3, lineTotalCents: 18 });
    expect(sumInvoiceLines([line, line])).toEqual({ subtotalCents: 30, vatTotalCents: 6, totalCents: 36 });
  });

  it("zachová devět desetinných míst i u velké celé části", () => {
    const quantity = normalizeQuantity("123456789,123456789");
    expect(quantity).toBe("123456789.123456789");
    expect(formatQuantity(quantity)).toBe("123\u00a0456\u00a0789,123456789");
    expect(calculateInvoiceLine({ quantity, unitPriceCents: 1, vatRate: 0 }).lineSubtotalCents)
      .toBe(123456789);
  });

  it("nepřepisuje vyšší přesnost množství před výpočtem", () => {
    expect(calculateInvoiceLine({ quantity: "1.2345", unitPriceCents: 100000, vatRate: 0 }).lineTotalCents)
      .toBe(123450);
    expect(normalizeQuantity("0,000000001")).toBe("0.000000001");
  });

  it.each(["0", "-1", "1000000000", "1.0000000001", "2.5abc", "Infinity", "0xff", "1e-999999999"])
    ("odmítne nepodporované množství %s bez tichého ořezu", (value) => {
      expect(() => normalizeQuantity(value)).toThrow(ValidationError);
    });

  it("cenu převede na haléře bez chyby binárního floatu", () => {
    expect(moneyToCents("1.005")).toBe(101);
  });

  it("zachová dosavadní směr zaokrouhlení záporných položek importu", () => {
    expect(calculateInvoiceLine({ quantity: "0.5", unitPriceCents: -29, vatRate: 0 }).lineSubtotalCents)
      .toBe(-14);
  });

  it("CSV náhled nepřevede přesné množství na binární float", () => {
    const preview = previewInvoiceImport(
      "number;client_name;issued_on;lines__line__name;lines__line__quantity;lines__line__unit_price\n" +
      "PRECISION-1;Test;2026-10-11;Položka;123456789,123456789;0,01\n",
    );
    expect(preview.records[0].items[0].quantity).toBe("123456789.123456789");
  });
});

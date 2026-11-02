import { describe, expect, it } from "vitest";
import { previewInvoiceImport } from "@/lib/fakturoid-import";
import { MAX_IMPORT_ITEMS, MAX_IMPORT_ITEMS_PER_INVOICE } from "@/lib/import-limits";
import { readInvoiceImportNumber, validateInvoiceImport } from "@/lib/import-validation";
import { getValidationMessage, ValidationError } from "@/lib/validation";

function invoiceCsv(invoices: { number: string; count: number }[]) {
  return "number;client_name;issued_on;lines__line__name;lines__line__quantity;lines__line__unit_price\n" +
    invoices.map(({ number, count }) => `${number};Test;2026-11-01;Položka;1;1\n`.repeat(count)).join("");
}

describe("společné limity náhledu a serveru", () => {
  it("povolí přesně 500 položek faktury", () => {
    const preview = previewInvoiceImport(invoiceCsv([{ number: "LIMIT", count: MAX_IMPORT_ITEMS_PER_INVOICE }]));
    expect(preview.blockingError).toBeNull();
    expect(() => validateInvoiceImport(preview.records)).not.toThrow();
  });

  it("vysvětlí překročení limitu faktury v náhledu i na serveru", () => {
    const preview = previewInvoiceImport(invoiceCsv([{ number: "LIMIT", count: MAX_IMPORT_ITEMS_PER_INVOICE + 1 }]));
    expect(preview.records).toHaveLength(1);
    expect(preview.blockingError).toContain("LIMIT");
    expect(preview.blockingError).toContain("500 položek na fakturu");
    expect(() => validateInvoiceImport(preview.records)).toThrowError(expect.objectContaining({ code: "importLimit" }));
    expect(getValidationMessage("importLimit")).toContain("5000 položek celkem");
  });

  it("povolí celkový limit a odmítne další položku", () => {
    const invoices = Array.from({ length: MAX_IMPORT_ITEMS / MAX_IMPORT_ITEMS_PER_INVOICE }, (_, index) => ({ number: `LIMIT-${index}`, count: MAX_IMPORT_ITEMS_PER_INVOICE }));
    const valid = previewInvoiceImport(invoiceCsv(invoices));
    expect(valid.blockingError).toBeNull();
    expect(() => validateInvoiceImport(valid.records)).not.toThrow();
    const exceeded = previewInvoiceImport(invoiceCsv([...invoices, { number: "EXTRA", count: 1 }]));
    expect(exceeded.blockingError).toContain("5000 položek");
    expect(() => validateInvoiceImport(exceeded.records)).toThrowError(expect.objectContaining({ code: "importLimit" }));
  });

  it("nezapočítá existující doklad do limitů náhledu", () => {
    const csv = invoiceCsv([{ number: "LEGACY", count: 501 }, { number: "NEW", count: 1 }]);
    expect(previewInvoiceImport(csv).blockingError).not.toBeNull();
    expect(previewInvoiceImport(csv, ["LEGACY"]).blockingError).toBeNull();
  });
});

describe("identita přeskakovaných dokladů", () => {
  it.each([null, [], {}, { number: 123 }, { number: " " }])("odmítne neplatnou identitu %j", (value) => {
    expect(() => readInvoiceImportNumber(value)).toThrow(ValidationError);
  });

  it("načte číslo bez kontroly přeskakovaného obsahu", () => {
    expect(readInvoiceImportNumber({ number: " LEGACY ", items: null })).toBe("LEGACY");
  });
});

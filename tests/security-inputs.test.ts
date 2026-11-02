import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { toSpreadsheetCsvCell } from "@/lib/csv";
import { normalizeInvoiceAsset } from "@/lib/invoice-asset-validation";
import { validateInvoiceImport } from "@/lib/import-validation";
import { normalizeMoneyToCents } from "@/lib/validation";

function imported(price: unknown = 100) {
  return [{ number: "TEST", issueDate: "2026-11-01", items: [{ unitPrice: price, quantity: "1", vatRate: 0 }] }];
}

describe("nedůvěryhodné importy a výstupy", () => {
  it.each([-1, Infinity, NaN, "100", null, 10_000_000_000])("odmítne neplatnou cenu %s", (value) => {
    expect(() => validateInvoiceImport(imported(value))).toThrow();
  });
  it("ověří všechny záznamy a rozsah výsledné částky", () => {
    expect(() => validateInvoiceImport([...imported(), ...imported(-1)])).toThrow();
    const rows = imported();
    rows[0].items[0].quantity = "999999999";
    expect(() => validateInvoiceImport(rows)).toThrow();
    expect(() => validateInvoiceImport(imported(0))).not.toThrow();
    expect(() => validateInvoiceImport([null])).toThrow();
  });
  it("odmítne neexistující datum", () => {
    expect(() => validateInvoiceImport([{ ...imported()[0], issueDate: "2026-02-30" }])).toThrow();
  });
  it.each(["1oops", "0xff", "1e999", "99999999999999"])("nepřevezme částečně přečtenou cenu %s", (value) => {
    expect(() => normalizeMoneyToCents(value)).toThrow();
  });
  it.each(["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", " \r=1+1", "＝1+1"])("neutralizuje textový vzorec %s", (value) => {
    expect(toSpreadsheetCsvCell(value)).toBe(`"\t${value}"`);
  });
  it("zachová skutečná čísla a escapuje oddělovače a uvozovky", () => {
    expect(toSpreadsheetCsvCell("-100.00", true)).toBe('"-100.00"');
    expect(toSpreadsheetCsvCell('a";b')).toBe('"a"";b"');
    expect(toSpreadsheetCsvCell("=1+1", true)).toBe('"\t=1+1"');
  });
  it("ověří a překóduje skutečný PNG; odmítne HTML i neodpovídající MIME", async () => {
    const data = PNG.sync.write(new PNG({ width: 2, height: 2 }));
    const normalized = await normalizeInvoiceAsset(data, "image/png");
    expect(normalized.mimeType).toBe("image/png");
    expect(PNG.sync.read(normalized.data).width).toBe(2);
    await expect(normalizeInvoiceAsset(Buffer.from("<html>test</html>"), "image/png")).rejects.toThrow();
    await expect(normalizeInvoiceAsset(data, "image/jpeg")).rejects.toThrow();
  });
});

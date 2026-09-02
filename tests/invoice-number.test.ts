import { describe, expect, it } from "vitest";

import {
  buildInvoiceNumber,
  buildVariableSymbol,
  extractInvoiceSerial,
  getInvoicePeriodKey,
  normalizeInvoiceNumberFormat,
} from "@/lib/invoice-number";
import { ValidationError } from "@/lib/validation";

const leden = new Date("2026-01-15T00:00:00");
const unor = new Date("2026-02-03T00:00:00");
const dalsiRok = new Date("2027-01-04T00:00:00");

describe("getInvoicePeriodKey", () => {
  it("rozlišuje měsíce, když formát obsahuje MM", () => {
    expect(getInvoicePeriodKey("YYYYMM###", leden)).toBe("202601");
    expect(getInvoicePeriodKey("YYYYMM###", unor)).toBe("202602");
  });

  it("rozlišuje jen roky, když formát měsíc nemá", () => {
    expect(getInvoicePeriodKey("YYYY####", leden)).toBe("2026");
    expect(getInvoicePeriodKey("YYYY####", unor)).toBe("2026");
    expect(getInvoicePeriodKey("YYYY####", dalsiRok)).toBe("2027");
  });

  it("u průběžné řady vrací prázdné období, takže se nikdy neresetuje", () => {
    expect(getInvoicePeriodKey("########", leden)).toBe("");
    expect(getInvoicePeriodKey("########", dalsiRok)).toBe("");
  });
});

describe("buildInvoiceNumber", () => {
  it("doplní rok, měsíc a pořadí na šířku zástupných znaků", () => {
    expect(buildInvoiceNumber("YYYYMM###", leden, 1)).toBe("202601001");
    expect(buildInvoiceNumber("YYYYMM####", leden, 42)).toBe("2026010042");
    expect(buildInvoiceNumber("YYYY####", unor, 7)).toBe("20260007");
  });

  it("zvládne oddělovače ve formátu", () => {
    expect(buildInvoiceNumber("YYYY-MM-###", leden, 9)).toBe("2026-01-009");
  });

  it("pořadí nad rámec šířky číslo neuřízne", () => {
    expect(buildInvoiceNumber("YYYYMM###", leden, 1234)).toBe("2026011234");
  });
});

describe("extractInvoiceSerial", () => {
  it("je opakem buildInvoiceNumber", () => {
    for (const format of ["YYYYMM###", "YYYY####", "YYYY-MM-###", "########"]) {
      const number = buildInvoiceNumber(format, leden, 37);

      expect(extractInvoiceSerial(format, leden, number)).toBe(37);
    }
  });

  it("nevrací pořadí pro číslo z jiného období", () => {
    const cisloZLedna = buildInvoiceNumber("YYYYMM###", leden, 5);

    expect(extractInvoiceSerial("YYYYMM###", unor, cisloZLedna)).toBeNull();
  });

  it("nevrací pořadí pro cizí formát čísla", () => {
    expect(extractInvoiceSerial("YYYYMM###", leden, "FA-2026-1")).toBeNull();
  });
});

describe("normalizeInvoiceNumberFormat", () => {
  it("prázdnou hodnotu nahradí výchozím formátem", () => {
    expect(normalizeInvoiceNumberFormat(null)).toBe("YYYYMM###");
    expect(normalizeInvoiceNumberFormat("  ")).toBe("YYYYMM###");
  });

  it("odmítne formát bez pořadového čísla", () => {
    expect(() => normalizeInvoiceNumberFormat("YYYYMM")).toThrow(
      ValidationError,
    );
  });

  it("odmítne nepovolené znaky", () => {
    expect(() => normalizeInvoiceNumberFormat("YYYY ###")).toThrow(
      ValidationError,
    );
  });
});

describe("buildVariableSymbol", () => {
  it("nechá jen číslice", () => {
    expect(buildVariableSymbol("2026-01-009")).toBe("202601009");
  });

  it("zkrátí na deset číslic zprava, aby ho banka přijala", () => {
    expect(buildVariableSymbol("202601000123456")).toBe("1000123456");
  });

  it("z čísla bez číslic udělá nulu", () => {
    expect(buildVariableSymbol("FAKTURA")).toBe("0");
  });
});

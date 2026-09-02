import { describe, expect, it } from "vitest";

import {
  normalizeAccountNumber,
  normalizeBankCode,
  normalizeDic,
  normalizeEmail,
  normalizeIban,
  normalizeIco,
  normalizeMoneyToCents,
  normalizeQuantity,
  normalizeVatRate,
  ValidationError,
} from "@/lib/validation";

describe("normalizeIco", () => {
  it("přijme IČO s platnou kontrolní číslicí", () => {
    expect(normalizeIco("27074358")).toBe("27074358");
    expect(normalizeIco("270 743 58")).toBe("27074358");
  });

  it("odmítne IČO s chybnou kontrolní číslicí", () => {
    expect(() => normalizeIco("12345678")).toThrow(ValidationError);
  });

  it("prázdné IČO je volitelné, dokud není vyžádané", () => {
    expect(normalizeIco(null)).toBeNull();
    expect(() => normalizeIco(null, true)).toThrow(ValidationError);
  });
});

describe("normalizeDic a normalizeEmail", () => {
  it("DIČ převede na velká písmena bez mezer", () => {
    expect(normalizeDic(" cz27074358 ")).toBe("CZ27074358");
  });

  it("odmítne DIČ bez předpony CZ", () => {
    expect(() => normalizeDic("27074358")).toThrow(ValidationError);
  });

  it("e-mail převede na malá písmena", () => {
    expect(normalizeEmail(" Alfa@Example.COM ")).toBe("alfa@example.com");
  });

  it("odmítne e-mail bez domény", () => {
    expect(() => normalizeEmail("alfa@example")).toThrow(ValidationError);
  });
});

describe("bankovní údaje", () => {
  it("kód banky musí mít čtyři číslice", () => {
    expect(normalizeBankCode("0800")).toBe("0800");
    expect(() => normalizeBankCode("80")).toThrow(ValidationError);
  });

  it("přijme číslo účtu s předčíslím", () => {
    expect(normalizeAccountNumber("19-2000145399", "0800")).toBe(
      "19-2000145399",
    );
  });

  it("odmítne číslo účtu, které neprojde modulo 11", () => {
    expect(() => normalizeAccountNumber("123456789", "0800")).toThrow(
      ValidationError,
    );
  });

  it("odmítne neplatný IBAN a přijme platný", () => {
    expect(normalizeIban("CZ65 0800 0000 1920 0014 5399")).toBe(
      "CZ6508000000192000145399",
    );
    expect(() => normalizeIban("CZ0000000000000000000000")).toThrow(
      ValidationError,
    );
  });
});

describe("částky a množství", () => {
  it("částku převede na haléře a zvládne desetinnou čárku", () => {
    expect(normalizeMoneyToCents("1234,56")).toBe(123456);
    expect(normalizeMoneyToCents("1 234.5")).toBe(123450);
  });

  it("odmítne zápornou částku i prázdnou hodnotu", () => {
    expect(() => normalizeMoneyToCents("-1")).toThrow(ValidationError);
    expect(() => normalizeMoneyToCents("")).toThrow(ValidationError);
  });

  it("množství musí být kladné", () => {
    expect(normalizeQuantity("2,5")).toBe(2.5);
    expect(() => normalizeQuantity("0")).toThrow(ValidationError);
  });

  it("sazba DPH musí být v rozsahu 0 až 100", () => {
    expect(normalizeVatRate("21")).toBe(21);
    expect(normalizeVatRate("")).toBe(0);
    expect(() => normalizeVatRate("120")).toThrow(ValidationError);
  });
});

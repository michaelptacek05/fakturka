import QRCode from "qrcode";
import { describe, expect, it } from "vitest";

import { buildVariableSymbol } from "@/lib/invoice-number";
import {
  buildSpaydPayload,
  getExpectedCzechBic,
  getPaymentIban,
  isValidCzechAccountNumber,
  isValidIban,
  sanitizeSpaydPayload,
  validateBankProfile,
} from "@/lib/spayd";

import { decodeQr, QR_MARGIN, QR_OPTIONS } from "./qr-decode";

describe("IBAN dopočítaný z čísla účtu", () => {
  it("spočítá kontrolní číslice podle mod 97", () => {
    expect(
      getPaymentIban({ accountNumber: "19-2000145399", bankCode: "0800" }),
    ).toBe("CZ6508000000192000145399");
    expect(
      getPaymentIban({ accountNumber: "2101234567", bankCode: "2010" }),
    ).toBe("CZ9120100000002101234567");
    expect(
      getPaymentIban({ accountNumber: "123456789", bankCode: "0300" }),
    ).toBe("CZ6203000000000123456789");
  });

  it("doplní předčíslí na šest a číslo účtu na deset míst", () => {
    expect(
      getPaymentIban({ accountNumber: "35-1234567", bankCode: "0100" }),
    ).toBe("CZ3001000000350001234567");
    expect(getPaymentIban({ accountNumber: "1234567", bankCode: "0100" })).toBe(
      "CZ6601000000000001234567",
    );
  });

  it("použije IBAN z profilu, pokud je platný", () => {
    expect(
      getPaymentIban({
        accountNumber: "19-2000145399",
        bankCode: "0800",
        iban: "sk31 1200 0000 1987 4263 7541",
      }),
    ).toBe("SK3112000000198742637541");
  });

  it("neplatný IBAN z profilu ignoruje a dopočítá vlastní", () => {
    expect(
      getPaymentIban({
        accountNumber: "19-2000145399",
        bankCode: "0800",
        iban: "CZ0000000000000000000000",
      }),
    ).toBe("CZ6508000000192000145399");
  });
});

describe("kontroly bankovních údajů", () => {
  it("ověří IBAN přes mod 97", () => {
    expect(isValidIban("CZ65 0800 0000 1920 0014 5399")).toBe(true);
    expect(isValidIban("CZ6508000000192000145398")).toBe(false);
    // Český IBAN má vždy 24 znaků, kratší nesmí projít ani s dobrým součtem.
    expect(isValidIban("CZ6508000000192000")).toBe(false);
    expect(isValidIban(null)).toBe(false);
  });

  it("ověří číslo účtu přes mod 11", () => {
    expect(isValidCzechAccountNumber("19-2000145399", "0800")).toBe(true);
    expect(isValidCzechAccountNumber("123456789", "0300")).toBe(false);
    expect(isValidCzechAccountNumber("19-2000145399", "80")).toBe(false);
  });

  it("zná BIC k českým kódům bank", () => {
    expect(getExpectedCzechBic("0800")).toBe("GIBACZPX");
    expect(getExpectedCzechBic("9999")).toBeNull();
  });

  it("upozorní na IBAN, který neodpovídá číslu účtu", () => {
    const result = validateBankProfile({
      accountNumber: "19-2000145399",
      bankCode: "0800",
      iban: "SK3112000000198742637541",
      swift: "GIBACZPX",
    });

    expect(result.issues).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.paymentIban).toBe("SK3112000000198742637541");
  });

  it("označí rozporuplný SWIFT i nevalidní číslo účtu", () => {
    const result = validateBankProfile({
      accountNumber: "123456789",
      bankCode: "0800",
      iban: null,
      swift: "KOMBCZPP",
    });

    expect(result.issues).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });
});

describe("SPAYD payload", () => {
  it("složí kompletní příkaz ve správném pořadí", () => {
    expect(
      buildSpaydPayload({
        accountNumber: "19-2000145399",
        amount: "12100.5",
        bankCode: "0800",
        currency: "CZK",
        dueDate: new Date(2026, 8, 30),
        message: "Faktura 2026-0001",
        variableSymbol: "20260001",
      }),
    ).toBe(
      "SPD*1.0*ACC:CZ6508000000192000145399*AM:12100.50*CC:CZK*DT:20260930*MSG:FAKTURA 2026-0001*X-VS:20260001",
    );
  });

  it("vynechá volitelná pole, když chybí", () => {
    expect(
      buildSpaydPayload({
        accountNumber: "19-2000145399",
        amount: 1,
        bankCode: "0800",
      }),
    ).toBe("SPD*1.0*ACC:CZ6508000000192000145399*AM:1.00*CC:CZK");
  });

  it("částku zaokrouhlí na dvě desetinná místa", () => {
    const fromDecimal = { toString: () => "1234.567" };

    expect(
      buildSpaydPayload({
        accountNumber: "19-2000145399",
        amount: fromDecimal,
        bankCode: "0800",
      }),
    ).toContain("*AM:1234.57*");
    expect(
      buildSpaydPayload({
        accountNumber: "19-2000145399",
        amount: 0.1 + 0.2,
        bankCode: "0800",
      }),
    ).toContain("*AM:0.30*");
  });

  it("ze zprávy odstraní diakritiku, hvězdičky a přebytečnou délku", () => {
    const payload = buildSpaydPayload({
      accountNumber: "19-2000145399",
      amount: 1,
      bankCode: "0800",
      message: "Příliš žluťoučký kůň * úpěl ďábelské ódy a zpíval si u toho",
    });
    const message = payload.split("*MSG:")[1];

    // Hvězdička je oddělovač polí, ve zprávě nesmí zůstat.
    expect(message).not.toContain("*");
    expect(message).toBe("PRILIS ZLUTOUCKY KUN UPEL DABELSKE ODY A ZPIVAL SI U TOHO");
  });

  it("zprávu zkrátí na 60 znaků podle normy", () => {
    const payload = buildSpaydPayload({
      accountNumber: "19-2000145399",
      amount: 1,
      bankCode: "0800",
      message: "a".repeat(100),
    });

    expect(payload.split("*MSG:")[1]).toHaveLength(60);
  });

  it("z variabilního symbolu nechá jen číslice", () => {
    expect(
      buildSpaydPayload({
        accountNumber: "19-2000145399",
        amount: 1,
        bankCode: "0800",
        variableSymbol: "2026-0001",
      }),
    ).toContain("*X-VS:20260001");
  });

  it("variabilní symbol zkrátí na deset číslic podle normy", () => {
    // Import cizích dat může přinést delší VS než buildVariableSymbol vyrobí.
    const payload = buildSpaydPayload({
      accountNumber: "19-2000145399",
      amount: 1,
      bankCode: "0800",
      variableSymbol: "2026000123456",
    });

    expect(payload).toContain("*X-VS:6000123456");
    expect(payload.split("*X-VS:")[1]).toHaveLength(10);
  });

  it("zkracuje VS stejně jako buildVariableSymbol", () => {
    const invoiceNumber = "2026-0001234567";

    expect(
      buildSpaydPayload({
        accountNumber: "19-2000145399",
        amount: 1,
        bankCode: "0800",
        variableSymbol: invoiceNumber,
      }),
    ).toContain(`*X-VS:${buildVariableSymbol(invoiceNumber)}`);
  });

  it("připojí BIC jen na vyžádání", () => {
    expect(
      buildSpaydPayload({
        accountNumber: "19-2000145399",
        amount: 1,
        bankCode: "0800",
        includeBic: true,
      }),
    ).toContain("ACC:CZ6508000000192000145399+GIBACZPX");
  });

  it("nesmyslné datum splatnosti vynechá místo rozbitého DT", () => {
    const payload = buildSpaydPayload({
      accountNumber: "19-2000145399",
      amount: 1,
      bankCode: "0800",
      dueDate: "nesmysl",
    });

    expect(payload).not.toContain("DT:");
  });

  it("payload zůstane v tisknutelném ASCII", () => {
    const payload = buildSpaydPayload({
      accountNumber: "19-2000145399",
      amount: 1,
      bankCode: "0800",
      message: "Faktura 2026-0001 – dodávka č. 5",
      variableSymbol: "20260001",
    });

    expect(payload).toMatch(/^[\x20-\x7E]+$/);
  });

  it("sanitizace vyhodí řídicí znaky", () => {
    expect(sanitizeSpaydPayload("SPD*1.0*ACC:CZ65\n\tX")).toBe(
      "SPD*1.0*ACC:CZ65X",
    );
  });
});

describe("QR kód", () => {
  const payload = buildSpaydPayload({
    accountNumber: "19-2000145399",
    amount: "12100.50",
    bankCode: "0800",
    currency: "CZK",
    dueDate: new Date(2026, 8, 30),
    message: "Faktura 2026-0001",
    variableSymbol: "20260001",
  });

  // scale 8 kreslí web, scale 5 PDF. Obojí musí být čitelné.
  it.each([
    ["web", 8],
    ["pdf", 5],
  ])("čtečka přečte z %s obrázku přesně ten payload, co appka složila", (_name, scale) => {
    expect(decodeQr(payload, scale)).toBe(payload);
  });

  it("přečte i nejdelší zprávu, jakou norma dovolí", async () => {
    const longest = buildSpaydPayload({
      accountNumber: "19-2000145399",
      amount: "1234567.89",
      bankCode: "0800",
      dueDate: new Date(2026, 8, 30),
      includeBic: true,
      message: "b".repeat(60),
      variableSymbol: "1234567890",
    });

    expect(decodeQr(longest, 5)).toBe(longest);
    // Zároveň musí projít i skutečným rendererem, ne jen bitmapou v testu.
    await expect(
      QRCode.toBuffer(longest, { ...QR_OPTIONS, margin: QR_MARGIN, scale: 5 }),
    ).resolves.toBeInstanceOf(Buffer);
  });
});

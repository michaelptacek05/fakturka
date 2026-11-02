import Decimal from "decimal.js";

// Vlastní konfigurace, aby změna nastavení Decimal jinde neovlivnila doklady.
const InvoiceDecimal = Decimal.clone({ precision: 50 });
export const QUANTITY_DECIMAL_PLACES = 9;

/** Přesný řetězec pro Decimal(18,9), bez převodu přes binární float. */
export function normalizeItemQuantity(value: string | number) {
  if (typeof value === "string" && !/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    throw new Error("Množství musí být desetinné číslo.");
  }
  const quantity = new InvoiceDecimal(value);

  if (
    !quantity.isFinite() ||
    !quantity.greaterThan(0) ||
    quantity.greaterThanOrEqualTo(1_000_000_000) ||
    quantity.decimalPlaces() > QUANTITY_DECIMAL_PLACES
  ) {
    throw new Error("Množství je mimo podporovaný rozsah nebo přesnost.");
  }

  return quantity.toFixed();
}

export function moneyToCents(value: string | number) {
  return new InvoiceDecimal(value)
    .times(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_CEIL)
    .toNumber();
}

export type InvoiceLineAmounts = {
  lineSubtotalCents: number;
  lineVatCents: number;
  lineTotalCents: number;
};

/** Zaokrouhlujeme základ položky, potom její DPH, nakonec sčítáme haléře. */
export function calculateInvoiceLine({
  quantity,
  unitPriceCents,
  vatRate,
}: {
  quantity: string | number;
  unitPriceCents: number;
  vatRate: number;
}): InvoiceLineAmounts {
  const lineSubtotalCents = new InvoiceDecimal(quantity)
    .times(unitPriceCents)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_CEIL)
    .toNumber();
  const lineVatCents = new InvoiceDecimal(lineSubtotalCents)
    .times(vatRate)
    .dividedBy(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_CEIL)
    .toNumber();

  return {
    lineSubtotalCents,
    lineVatCents,
    lineTotalCents: lineSubtotalCents + lineVatCents,
  };
}

export function sumInvoiceLines(lines: readonly InvoiceLineAmounts[]) {
  return lines.reduce(
    (sum, line) => ({
      subtotalCents: sum.subtotalCents + line.lineSubtotalCents,
      vatTotalCents: sum.vatTotalCents + line.lineVatCents,
      totalCents: sum.totalCents + line.lineTotalCents,
    }),
    { subtotalCents: 0, vatTotalCents: 0, totalCents: 0 },
  );
}

/** Množství na dokladu musí ukazovat všechny uložené desetinné číslice. */
export function formatQuantity(value: { toString(): string } | string | number) {
  const [whole, fraction] = new InvoiceDecimal(value.toString()).toFixed().split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");

  return fraction ? `${grouped},${fraction}` : grouped;
}

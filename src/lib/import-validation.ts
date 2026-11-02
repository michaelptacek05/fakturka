import { calculateInvoiceLine, sumInvoiceLines } from "@/lib/invoice-calculations";
import { getInvoiceImportLimitError } from "@/lib/import-limits";
import { normalizeMoneyToCents, normalizeQuantity, ValidationError } from "@/lib/validation";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError("csv", "Neplatný záznam importu.");
  return value as Record<string, unknown>;
}

/** Identita se kontroluje i u přeskakovaných dokladů; jejich obsah se nepřepisuje. */
export function readInvoiceImportNumber(value: unknown): string {
  const invoice = record(value);
  if (typeof invoice.number !== "string" || !invoice.number.trim()) {
    throw new ValidationError("required", "Chybí číslo dokladu.");
  }
  return invoice.number.trim();
}

function validateTexts(value: Record<string, unknown>) {
  for (const field of Object.values(value)) {
    if (typeof field === "string" && field.length > 20_000) throw new ValidationError("csv", "Text importu je příliš dlouhý.");
  }
}

function validateDate(value: unknown, required = false) {
  if ((value === undefined || value === null || value === "") && !required) return;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError("date", "Neplatné datum importu.");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ValidationError("date", "Neplatné datum importu.");
}

/** Všechny nové doklady ověříme před prvním zápisem. Náhled není hranice důvěry. */
export function validateInvoiceImport(values: unknown[]) {
  const invoices = values.map((value) => {
    const invoice = record(value);
    if (!Array.isArray(invoice.items) || !invoice.items.length) {
      throw new ValidationError("item", "Neplatné položky importu.");
    }
    return { number: readInvoiceImportNumber(value), items: invoice.items };
  });
  const limitError = getInvoiceImportLimitError(invoices);
  if (limitError) throw new ValidationError("importLimit", limitError);

  for (const value of values) {
    const invoice = record(value);
    validateTexts(invoice);
    if (typeof invoice.number !== "string" || !invoice.number.trim() || invoice.number.length > 200) throw new ValidationError("required", "Chybí číslo dokladu.");
    validateDate(invoice.issueDate, true);
    for (const key of ["dueDate", "paidAt", "taxableSupplyDate"]) validateDate(invoice[key]);
    if (invoice.client != null) validateTexts(record(invoice.client));
    if (invoice.currency != null && (typeof invoice.currency !== "string" || !/^[A-Z]{3}$/i.test(invoice.currency))) throw new ValidationError("csv", "Neplatná měna.");
    if (!Array.isArray(invoice.items) || !invoice.items.length) throw new ValidationError("item", "Neplatné položky importu.");
    const lines = invoice.items.map((value) => {
      const item = record(value);
      validateTexts(item);
      if (typeof item.unitPrice !== "number" || !Number.isFinite(item.unitPrice)) throw new ValidationError("amount", "Neplatná cena.");
      const unitPriceCents = normalizeMoneyToCents(String(item.unitPrice));
      const quantity = normalizeQuantity(String(item.quantity ?? 1));
      const vatRate = item.vatRate ?? 0;
      if (typeof vatRate !== "number" || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new ValidationError("amount", "Neplatná sazba DPH.");
      const line = calculateInvoiceLine({ quantity, unitPriceCents, vatRate });
      for (const amount of Object.values(line)) validateCents(amount);
      return line;
    });
    for (const amount of Object.values(sumInvoiceLines(lines))) validateCents(amount);
    if (invoice.paidAmount != null) {
      if (typeof invoice.paidAmount !== "number") throw new ValidationError("payment", "Neplatná úhrada.");
      normalizeMoneyToCents(String(invoice.paidAmount));
    }
  }
}

function validateCents(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 999_999_999_999) throw new ValidationError("amount", "Částka je mimo rozsah databáze.");
}

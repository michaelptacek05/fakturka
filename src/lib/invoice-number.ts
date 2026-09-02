import { ValidationError } from "@/lib/validation";

export const DEFAULT_INVOICE_NUMBER_FORMAT = "YYYYMM###";

export const INVOICE_NUMBER_FORMATS = [
  {
    example: "2026090001",
    label: "Rok, měsíc a pořadí — řada se resetuje každý měsíc",
    value: "YYYYMM####",
  },
  {
    example: "202609001",
    label: "Rok, měsíc a pořadí (3 místa) — reset každý měsíc",
    value: DEFAULT_INVOICE_NUMBER_FORMAT,
  },
  {
    example: "20260001",
    label: "Rok a pořadí — řada se resetuje každý rok",
    value: "YYYY####",
  },
  {
    example: "00000001",
    label: "Průběžné pořadí bez resetu",
    value: "########",
  },
] as const;

function formatYear(date: Date) {
  return String(date.getFullYear());
}

function formatMonth(date: Date) {
  return String(date.getMonth() + 1).padStart(2, "0");
}

/**
 * Klíč období, ke kterému patří pořadové číslo. Jakmile se změní,
 * číselná řada začíná znovu od jedničky.
 */
export function getInvoicePeriodKey(format: string, date: Date) {
  if (format.includes("MM")) {
    return `${formatYear(date)}${formatMonth(date)}`;
  }

  if (format.includes("YYYY")) {
    return formatYear(date);
  }

  return "";
}

export function normalizeInvoiceNumberFormat(value: string | null | undefined) {
  const format = value?.trim();

  if (!format) {
    return DEFAULT_INVOICE_NUMBER_FORMAT;
  }

  if (!format.includes("#")) {
    throw new ValidationError(
      "format",
      "Formát čísla faktury musí obsahovat alespoň jeden znak # pro pořadové číslo.",
    );
  }

  if (!/^[A-Za-z0-9#\-/.]+$/.test(format)) {
    throw new ValidationError(
      "format",
      "Formát čísla faktury smí obsahovat jen písmena, číslice, #, pomlčku, lomítko a tečku.",
    );
  }

  return format;
}

/** Doplní do šablony rok a měsíc, pořadové číslo nechá být. */
export function applyInvoiceNumberTokens(template: string, date: Date) {
  return template
    .replace(/YYYY/g, formatYear(date))
    .replace(/MM/g, formatMonth(date));
}

export function buildInvoiceNumber(
  format: string,
  issueDate: Date,
  serial: number,
) {
  const placeholder = /#+/.exec(format);
  const width = placeholder ? placeholder[0].length : 3;

  return applyInvoiceNumberTokens(format, issueDate).replace(
    /#+/,
    String(serial).padStart(width, "0"),
  );
}

/**
 * Opak `buildInvoiceNumber` — z existujícího čísla vytáhne pořadí, pokud číslo
 * odpovídá danému formátu a datu. Používá se po importu, aby další vystavená
 * faktura nedostala číslo, které už v databázi je.
 */
export function extractInvoiceSerial(
  format: string,
  issueDate: Date,
  invoiceNumber: string,
) {
  const placeholder = /#+/.exec(format);

  if (!placeholder || placeholder.index === undefined) {
    return null;
  }

  const prefix = applyInvoiceNumberTokens(
    format.slice(0, placeholder.index),
    issueDate,
  );
  const suffix = applyInvoiceNumberTokens(
    format.slice(placeholder.index + placeholder[0].length),
    issueDate,
  );

  if (
    !invoiceNumber.startsWith(prefix) ||
    !invoiceNumber.endsWith(suffix) ||
    invoiceNumber.length <= prefix.length + suffix.length
  ) {
    return null;
  }

  const serialText = invoiceNumber.slice(
    prefix.length,
    invoiceNumber.length - suffix.length,
  );

  if (!/^\d+$/.test(serialText)) {
    return null;
  }

  return Number.parseInt(serialText, 10);
}

/**
 * Variabilní symbol je jen číslice a banky ho přijímají nejvýše desetimístný.
 * U delších čísel bereme konec, který nese pořadí faktury.
 */
export function buildVariableSymbol(invoiceNumber: string) {
  const digits = invoiceNumber.replace(/\D/g, "");

  if (digits.length === 0) {
    return "0";
  }

  return digits.length > 10 ? digits.slice(-10) : digits;
}

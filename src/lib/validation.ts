import {
  isValidCzechAccountNumber,
  isValidIban,
} from "@/lib/spayd";

export type ValidationCode =
  | "account"
  | "amount"
  | "bank"
  | "date"
  | "dic"
  | "email"
  | "iban"
  | "ico"
  | "item"
  | "quantity"
  | "required";

export class ValidationError extends Error {
  code: ValidationCode;

  constructor(code: ValidationCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function getValidationCode(error: unknown): ValidationCode {
  return error instanceof ValidationError ? error.code : "required";
}

export function getValidationErrorParam(error: unknown) {
  return encodeURIComponent(getValidationCode(error));
}

export function getValidationMessage(error?: string | string[]) {
  switch (error) {
    case "account":
      return "Číslo účtu nemá platný český formát nebo neprošlo kontrolou.";
    case "amount":
      return "Zkontrolujte částky. Cena musí být nezáporné číslo a sazba DPH musí být mezi 0 a 100.";
    case "bank":
      return "Kód banky musí mít 4 číslice.";
    case "date":
      return "Zkontrolujte data dokladu.";
    case "dic":
      return "DIČ nemá očekávaný formát.";
    case "email":
      return "E-mail nemá platný formát.";
    case "iban":
      return "IBAN není platný.";
    case "ico":
      return "IČO nemá platný český formát.";
    case "item":
      return "Faktura musí mít alespoň jednu položku s názvem.";
    case "quantity":
      return "Množství položky musí být větší než nula.";
    case "required":
    case "validation":
      return "Zkontrolujte prosím povinné údaje.";
    default:
      return null;
  }
}

export function getRequiredFormString(
  formData: FormData,
  key: string,
  code: ValidationCode = "required",
) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(code, `Pole ${key} je povinné.`);
  }

  return value.trim();
}

export function getOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizeDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") || null;
}

function isValidCzechIco(value: string) {
  if (!/^\d{8}$/.test(value)) {
    return false;
  }

  const weights = [8, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (total, weight, index) => total + Number(value[index]) * weight,
    0,
  );
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 1 : remainder === 1 ? 0 : 11 - remainder;

  return checkDigit === Number(value[7]);
}

export function normalizeIco(value: string | null | undefined, required = false) {
  const normalized = normalizeDigits(value);

  if (!normalized) {
    if (required) {
      throw new ValidationError("ico", "IČO je povinné.");
    }

    return null;
  }

  if (!isValidCzechIco(normalized)) {
    throw new ValidationError("ico", "IČO nemá platný český formát.");
  }

  return normalized;
}

export function normalizeDic(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.replace(/\s/g, "").toUpperCase();

  if (!/^CZ[A-Z0-9]{8,12}$/.test(normalized)) {
    throw new ValidationError("dic", "DIČ nemá očekávaný formát.");
  }

  return normalized;
}

export function normalizeEmail(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ValidationError("email", "E-mail nemá platný formát.");
  }

  return normalized;
}

export function normalizeBankCode(value: string) {
  const normalized = normalizeDigits(value) ?? "";

  if (!/^\d{4}$/.test(normalized)) {
    throw new ValidationError("bank", "Kód banky musí mít 4 číslice.");
  }

  return normalized;
}

export function normalizeAccountNumber(value: string, bankCode: string) {
  const normalized = value.replace(/\s/g, "");

  if (!/^(\d{1,6}-)?\d{2,10}$/.test(normalized)) {
    throw new ValidationError("account", "Číslo účtu nemá platný formát.");
  }

  if (!isValidCzechAccountNumber(normalized, bankCode)) {
    throw new ValidationError("account", "Číslo účtu neprošlo českou kontrolou.");
  }

  return normalized;
}

export function normalizeIban(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.replace(/\s/g, "").toUpperCase();

  if (!isValidIban(normalized)) {
    throw new ValidationError("iban", "IBAN není platný.");
  }

  return normalized;
}

export function normalizeMoneyToCents(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError("amount", "Částka je povinná.");
  }

  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError("amount", "Částka musí být nezáporné číslo.");
  }

  return Math.round(parsed * 100);
}

export function normalizeQuantity(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError("quantity", "Množství je povinné.");
  }

  const parsed = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ValidationError("quantity", "Množství musí být větší než nula.");
  }

  return parsed;
}

export function normalizeVatRate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 0;
  }

  const parsed = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new ValidationError("amount", "Sazba DPH musí být mezi 0 a 100.");
  }

  return parsed;
}

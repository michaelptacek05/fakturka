export const currencyFormatter = new Intl.NumberFormat("cs-CZ", {
  currency: "CZK",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

export const numberFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 3,
});

export function formatCurrency(value: number | string | { toString(): string }) {
  return currencyFormatter.format(Number(value.toString()));
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function decimalFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export function parseMoneyToCents(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

export function parseQuantity(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return 0;
  }

  const parsed = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Pole ${key} je povinné.`);
  }

  return value.trim();
}

export function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function toDate(value: string | null, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

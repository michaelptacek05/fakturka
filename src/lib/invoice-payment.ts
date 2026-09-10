import { InvoiceStatus } from "@/generated/prisma/enums";

/** Decimal z Prismy, číslo i řetězec — všechno umí `toString()`. */
export type MoneyLike = number | string | { toString(): string };

export type PaymentRecord = {
  amount: MoneyLike;
  paidOn: Date;
};

export type PayableInvoice = {
  dueDate: Date;
  paidAmount: MoneyLike;
  status: InvoiceStatus;
  total: MoneyLike;
};

/**
 * Stavy, u kterých doklad ještě čeká na peníze. `OVERDUE` se dnes do databáze
 * nezapisuje, ale enum ho zná — kdyby se objevil, musí se chovat jako vystavený.
 */
const OPEN_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.OVERDUE,
];

/**
 * Vizuální stavy dokladu. `partial` ani `overdue` nejsou v databázi —
 * dopočítávají se z uhrazené částky a data splatnosti, v `status` zůstává ISSUED.
 */
export type InvoiceVisualState =
  | "default"
  | "unpaid"
  | "partial"
  | "overdue"
  | "paid"
  | "cancelled";

/**
 * Peníze počítáme v haléřích. Decimal(12,2) se přes float zaokrouhluje
 * nepřesně a součet plateb se pak nepotká s celkovou částkou faktury.
 */
export function toCents(value: MoneyLike) {
  const amount = Number(value.toString());
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function fromCents(cents: number) {
  return cents / 100;
}

export function sumPaymentsCents(payments: readonly PaymentRecord[]) {
  return payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
}

export type PaymentSummary = {
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
  paidCents: number;
  remainingCents: number;
  totalCents: number;
};

export function getPaymentSummary(invoice: {
  paidAmount: MoneyLike;
  total: MoneyLike;
}): PaymentSummary {
  const totalCents = toCents(invoice.total);
  const paidCents = toCents(invoice.paidAmount);
  // Přeplatek nesmí vyrobit zápornou zbývající částku.
  const remainingCents = Math.max(totalCents - paidCents, 0);

  return {
    // Doklad na nulovou částku nemá co inkasovat, je vyrovnaný z definice.
    isFullyPaid: paidCents >= totalCents,
    isPartiallyPaid: paidCents > 0 && paidCents < totalCents,
    paidCents,
    remainingCents,
    totalCents,
  };
}

export type ResolvedPaymentState = {
  paidAmount: string;
  paidAt: Date | null;
  status: InvoiceStatus;
};

/**
 * Odvodí stav dokladu z jeho plateb. Storno má přednost — u stornované
 * faktury se stav nepřepisuje, i kdyby na ní historicky nějaká platba visela.
 */
export function resolvePaymentState({
  currentStatus,
  payments,
  total,
}: {
  currentStatus: InvoiceStatus;
  payments: readonly PaymentRecord[];
  total: MoneyLike;
}): ResolvedPaymentState {
  const paidCents = sumPaymentsCents(payments);
  const paidAmount = fromCents(paidCents).toFixed(2);

  if (currentStatus === InvoiceStatus.CANCELLED) {
    return { paidAmount, paidAt: null, status: InvoiceStatus.CANCELLED };
  }

  if (paidCents < toCents(total)) {
    // Koncept zůstane konceptem i s částečnou úhradou, jinak je doklad vystavený.
    const status =
      currentStatus === InvoiceStatus.DRAFT
        ? InvoiceStatus.DRAFT
        : InvoiceStatus.ISSUED;

    return { paidAmount, paidAt: null, status };
  }

  const lastPaidOn = payments.reduce<Date | null>((latest, payment) => {
    return latest === null || payment.paidOn > latest ? payment.paidOn : latest;
  }, null);

  return {
    paidAmount,
    paidAt: lastPaidOn ?? new Date(),
    status: InvoiceStatus.PAID,
  };
}

/**
 * Jediné místo, kde se rozhoduje o barvě a štítku dokladu. Seznam, detail
 * i dashboard musí říkat totéž.
 */
export function getInvoiceVisualState(
  invoice: PayableInvoice,
  today = new Date(),
): InvoiceVisualState {
  if (invoice.status === InvoiceStatus.CANCELLED) {
    return "cancelled";
  }

  if (invoice.status === InvoiceStatus.PAID) {
    return "paid";
  }

  // Stav rozhoduje dřív než částka, jinak by koncept s vyplněnou úhradou
  // vypadal jako zaplacený doklad.
  if (!OPEN_STATUSES.includes(invoice.status)) {
    return "default";
  }

  const summary = getPaymentSummary(invoice);

  if (summary.isFullyPaid) {
    return "paid";
  }

  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const isOverdue = invoice.dueDate < todayStart;

  if (isOverdue) {
    return "overdue";
  }

  return summary.isPartiallyPaid ? "partial" : "unpaid";
}

/** Doklad, který má ještě co inkasovat — nezaplacený zbytek nad nulu. */
export function isOutstanding(invoice: PayableInvoice) {
  if (!OPEN_STATUSES.includes(invoice.status)) {
    return false;
  }

  return getPaymentSummary(invoice).remainingCents > 0;
}

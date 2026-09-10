import { ActivityType, InvoiceStatus } from "@/generated/prisma/enums";
import {
  fromCents,
  getInvoiceVisualState,
  getPaymentSummary,
  isOutstanding,
  sumPaymentsCents,
  toCents,
  type MoneyLike,
} from "@/lib/invoice-payment";
import { estimateTaxes, type TaxSettings } from "@/lib/tax-estimate";

/** Když profil ještě neexistuje, počítáme jako hlavní činnost bez slev. */
const DEFAULT_TAX_SETTINGS: TaxSettings = {
  activityType: ActivityType.MAIN,
  applyTaxpayerCredit: false,
  flatExpenseRate: 60,
  socialThreshold: 117_521,
  taxpayerCredit: 30_840,
};

const VAT_LIMIT_CZK = 2_000_000;

type DashboardInvoice = {
  /** Snapshot odběratele z faktury, ne aktuální stav adresáře. */
  clientName: string;
  dueDate: Date;
  id: string;
  issueDate: Date;
  number: string;
  /** Denormalizovaný součet plateb, zdrojem pravdy zůstává `payments`. */
  paidAmount: MoneyLike;
  payments: { amount: MoneyLike; paidOn: Date }[];
  status: InvoiceStatus;
  taxableSupplyDate: Date | null;
  total: MoneyLike;
};

/** Přes haléře, ať se zobrazená částka nerozchází se součty v grafu a metrikách. */
function toAmount(value: MoneyLike) {
  return fromCents(toCents(value));
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sumTotalsCents(invoices: DashboardInvoice[]) {
  return invoices.reduce((sum, invoice) => sum + toCents(invoice.total), 0);
}

/** U nezaplacených nás zajímá, kolik ještě přijde, ne na kolik byl doklad vystavený. */
function sumRemainingCents(invoices: DashboardInvoice[]) {
  return invoices.reduce(
    (sum, invoice) => sum + getPaymentSummary(invoice).remainingCents,
    0,
  );
}

/** Platby s datem úhrady v intervalu <from, to). */
function getPaymentsInRange(invoice: DashboardInvoice, from: Date, to: Date) {
  return invoice.payments.filter(
    (payment) => payment.paidOn >= from && payment.paidOn < to,
  );
}

/**
 * Příjmy vycházejí ze skutečných plateb, ne z celkových částek faktur — jinak by
 * částečná úhrada spadla do měsíce buď celá, nebo vůbec. `count` je počet faktur
 * s úhradou, ne počet plateb: dvě splátky téže faktury jsou pořád jedna faktura.
 */
function getRevenueInRange(invoices: DashboardInvoice[], from: Date, to: Date) {
  return invoices.reduce(
    (accumulator, invoice) => {
      const periodCents = sumPaymentsCents(getPaymentsInRange(invoice, from, to));

      // Doklad, kde se přijetí a vrácení v období vyruší, nepřinesl nic —
      // do počtu faktur s úhradou proto nepatří.
      return periodCents === 0
        ? accumulator
        : {
            count: accumulator.count + 1,
            totalCents: accumulator.totalCents + periodCents,
          };
    },
    { count: 0, totalCents: 0 },
  );
}

function getRevenueDate(invoice: DashboardInvoice) {
  return invoice.taxableSupplyDate ?? invoice.issueDate;
}

export function buildDashboardData(
  invoices: DashboardInvoice[],
  today = new Date(),
  taxSettings: TaxSettings = DEFAULT_TAX_SETTINGS,
) {
  const todayStart = startOfDay(today);
  const monthStart = startOfMonth(today);
  const nextMonthStart = addMonths(monthStart, 1);
  const quarterStart = startOfQuarter(today);
  const nextQuarterStart = addMonths(quarterStart, 3);
  const yearStart = startOfYear(today);
  const nextYearStart = new Date(today.getFullYear() + 1, 0, 1);
  const vatWindowStart = new Date(todayStart);
  vatWindowStart.setFullYear(vatWindowStart.getFullYear() - 1);
  const chartStart = addMonths(monthStart, -11);
  const months = Array.from({ length: 12 }, (_, index) =>
    addMonths(chartStart, index),
  );

  // Storno ruší doklad, ne pohyb peněz — platby se proto počítají i na
  // stornovaných fakturách. Vrácená úhrada je záporná platba, takže se
  // odečte sama v tom období, kdy peníze reálně odešly.
  const monthRevenue = getRevenueInRange(invoices, monthStart, nextMonthStart);
  const quarterRevenue = getRevenueInRange(
    invoices,
    quarterStart,
    nextQuarterStart,
  );
  const yearRevenue = getRevenueInRange(invoices, yearStart, nextYearStart);
  const unpaid = invoices.filter((invoice) => isOutstanding(invoice));
  const overdue = unpaid.filter((invoice) => invoice.dueDate < todayStart);
  // Limit DPH je obrat, ne cash — počítá se z celé částky k datu plnění.
  const vatLimitInvoices = invoices.filter((invoice) => {
    const revenueDate = getRevenueDate(invoice);

    return (
      invoice.status !== InvoiceStatus.CANCELLED &&
      revenueDate >= vatWindowStart &&
      revenueDate < nextMonthStart
    );
  });

  const monthlyRevenue = months.map((month) => {
    const nextMonth = addMonths(month, 1);

    return {
      key: monthKey(month),
      label: new Intl.DateTimeFormat("cs-CZ", { month: "short" }).format(month),
      total: fromCents(getRevenueInRange(invoices, month, nextMonth).totalCents),
    };
  });
  const maxMonthlyRevenue = Math.max(...monthlyRevenue.map((item) => item.total), 0);
  // Odvody se odhadují ze skutečného cash flow, tedy z plateb přijatých letos.
  const annualPaidRevenue = fromCents(yearRevenue.totalCents);
  const estimate = estimateTaxes(annualPaidRevenue, taxSettings);
  const vatLimitRevenue = fromCents(sumTotalsCents(vatLimitInvoices));
  const recentInvoices = invoices
    .slice()
    .sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime())
    .slice(0, 5)
    .map((invoice) => ({
      clientName: invoice.clientName || "—",
      dueDate: invoice.dueDate,
      id: invoice.id,
      number: invoice.number,
      paidAmount: toAmount(invoice.paidAmount),
      status: invoice.status,
      total: toAmount(invoice.total),
      // Stav se dopočítává tady, ať přehled i seznam faktur říkají totéž.
      visualState: getInvoiceVisualState(invoice, today),
    }));

  return {
    estimate,
    maxMonthlyRevenue,
    metrics: {
      month: {
        count: monthRevenue.count,
        total: fromCents(monthRevenue.totalCents),
      },
      overdue: {
        count: overdue.length,
        total: fromCents(sumRemainingCents(overdue)),
      },
      quarter: {
        count: quarterRevenue.count,
        total: fromCents(quarterRevenue.totalCents),
      },
      unpaid: {
        count: unpaid.length,
        total: fromCents(sumRemainingCents(unpaid)),
      },
      vatLimit: {
        limit: VAT_LIMIT_CZK,
        percentage: Math.min((vatLimitRevenue / VAT_LIMIT_CZK) * 100, 100),
        remaining: Math.max(VAT_LIMIT_CZK - vatLimitRevenue, 0),
        total: vatLimitRevenue,
      },
      year: {
        count: yearRevenue.count,
        total: fromCents(yearRevenue.totalCents),
      },
    },
    monthlyRevenue,
    recentInvoices,
  };
}

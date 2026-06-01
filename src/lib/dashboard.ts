import { InvoiceStatus } from "@/generated/prisma/enums";

const VAT_LIMIT_CZK = 2_000_000;
const FLAT_EXPENSE_RATE = 0.6;
const FLAT_EXPENSE_CAP = 1_200_000;
const INCOME_TAX_RATE = 0.15;
const SOCIAL_ASSESSMENT_RATE = 0.55;
const SOCIAL_INSURANCE_RATE = 0.292;
const HEALTH_ASSESSMENT_RATE = 0.5;
const HEALTH_INSURANCE_RATE = 0.135;

type DashboardInvoice = {
  client: {
    companyName: string | null;
    fullName: string | null;
  };
  dueDate: Date;
  id: string;
  issueDate: Date;
  number: string;
  paidAt: Date | null;
  status: InvoiceStatus;
  taxableSupplyDate: Date | null;
  total: { toString(): string };
};

function toAmount(value: { toString(): string }) {
  return Number(value.toString());
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

function sumInvoices(invoices: DashboardInvoice[]) {
  return invoices.reduce((sum, invoice) => sum + toAmount(invoice.total), 0);
}

function isPaidInRange(invoice: DashboardInvoice, from: Date, to: Date) {
  return (
    invoice.status === InvoiceStatus.PAID &&
    invoice.paidAt !== null &&
    invoice.paidAt >= from &&
    invoice.paidAt < to
  );
}

function getRevenueDate(invoice: DashboardInvoice) {
  return invoice.taxableSupplyDate ?? invoice.issueDate;
}

export function buildDashboardData(invoices: DashboardInvoice[], today = new Date()) {
  const todayStart = startOfDay(today);
  const monthStart = startOfMonth(today);
  const nextMonthStart = addMonths(monthStart, 1);
  const quarterStart = startOfQuarter(today);
  const yearStart = startOfYear(today);
  const nextYearStart = new Date(today.getFullYear() + 1, 0, 1);
  const vatWindowStart = new Date(todayStart);
  vatWindowStart.setFullYear(vatWindowStart.getFullYear() - 1);
  const chartStart = addMonths(monthStart, -11);
  const months = Array.from({ length: 12 }, (_, index) =>
    addMonths(chartStart, index),
  );

  const paidThisMonth = invoices.filter((invoice) =>
    isPaidInRange(invoice, monthStart, nextMonthStart),
  );
  const paidThisQuarter = invoices.filter((invoice) =>
    isPaidInRange(invoice, quarterStart, nextMonthStart),
  );
  const paidThisYear = invoices.filter((invoice) =>
    isPaidInRange(invoice, yearStart, nextYearStart),
  );
  const unpaid = invoices.filter(
    (invoice) => invoice.status === InvoiceStatus.ISSUED && invoice.paidAt === null,
  );
  const overdue = unpaid.filter((invoice) => invoice.dueDate < todayStart);
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
    const total = sumInvoices(
      invoices.filter((invoice) => isPaidInRange(invoice, month, nextMonth)),
    );

    return {
      key: monthKey(month),
      label: new Intl.DateTimeFormat("cs-CZ", { month: "short" }).format(month),
      total,
    };
  });
  const maxMonthlyRevenue = Math.max(...monthlyRevenue.map((item) => item.total), 0);
  const annualPaidRevenue = sumInvoices(paidThisYear);
  const flatExpenses = Math.min(
    annualPaidRevenue * FLAT_EXPENSE_RATE,
    FLAT_EXPENSE_CAP,
  );
  const taxBase = Math.max(annualPaidRevenue - flatExpenses, 0);
  const socialAssessmentBase = taxBase * SOCIAL_ASSESSMENT_RATE;
  const healthAssessmentBase = taxBase * HEALTH_ASSESSMENT_RATE;
  const vatLimitRevenue = sumInvoices(vatLimitInvoices);
  const recentInvoices = invoices
    .slice()
    .sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime())
    .slice(0, 5)
    .map((invoice) => ({
      clientName: invoice.client.companyName ?? invoice.client.fullName ?? "-",
      dueDate: invoice.dueDate,
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      total: toAmount(invoice.total),
    }));

  return {
    estimate: {
      flatExpenses,
      healthAssessmentBase,
      healthInsurance: healthAssessmentBase * HEALTH_INSURANCE_RATE,
      incomeTaxBeforeCredits: taxBase * INCOME_TAX_RATE,
      paidRevenue: annualPaidRevenue,
      socialAssessmentBase,
      socialInsurance: socialAssessmentBase * SOCIAL_INSURANCE_RATE,
      taxBase,
    },
    maxMonthlyRevenue,
    metrics: {
      month: {
        count: paidThisMonth.length,
        total: sumInvoices(paidThisMonth),
      },
      overdue: {
        count: overdue.length,
        total: sumInvoices(overdue),
      },
      quarter: {
        count: paidThisQuarter.length,
        total: sumInvoices(paidThisQuarter),
      },
      unpaid: {
        count: unpaid.length,
        total: sumInvoices(unpaid),
      },
      vatLimit: {
        limit: VAT_LIMIT_CZK,
        percentage: Math.min((vatLimitRevenue / VAT_LIMIT_CZK) * 100, 100),
        remaining: Math.max(VAT_LIMIT_CZK - vatLimitRevenue, 0),
        total: vatLimitRevenue,
      },
      year: {
        count: paidThisYear.length,
        total: annualPaidRevenue,
      },
    },
    monthlyRevenue,
    recentInvoices,
  };
}

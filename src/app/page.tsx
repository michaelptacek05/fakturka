import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CreditCard,
  FilePlus2,
  FileText,
  Gauge,
  PiggyBank,
  ReceiptText,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { InvoiceStatus } from "@/generated/prisma/enums";
import { buildDashboardData } from "@/lib/dashboard";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusLabels: Record<InvoiceStatus, string> = {
  [InvoiceStatus.CANCELLED]: "Stornováno",
  [InvoiceStatus.DRAFT]: "Koncept",
  [InvoiceStatus.ISSUED]: "Vystaveno",
  [InvoiceStatus.OVERDUE]: "Po splatnosti",
  [InvoiceStatus.PAID]: "Zaplaceno",
};

async function getDashboardInvoices() {
  try {
    return await prisma.invoice.findMany({
      include: {
        client: {
          select: {
            companyName: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return null;
  }
}

export default async function Home() {
  const invoices = await getDashboardInvoices();
  const dashboard = invoices ? buildDashboardData(invoices) : null;

  return (
    <main className="bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Fakturka</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
              Nástěnka OSVČ
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/clients/new">
                <Users className="size-4" aria-hidden="true" />
                Nový odběratel
              </Link>
            </Button>
            <Button asChild>
              <Link href="/invoices/new">
                <FilePlus2 className="size-4" aria-hidden="true" />
                Nová faktura
              </Link>
            </Button>
          </div>
        </header>

        {dashboard === null ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Databáze není dostupná. Spusťte PostgreSQL a migrace, potom stránku
            obnovte.
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              {[
                {
                  detail: `${dashboard.metrics.month.count} zaplacených faktur`,
                  icon: CreditCard,
                  label: "Měsíc",
                  value: formatCurrency(dashboard.metrics.month.total),
                },
                {
                  detail: `${dashboard.metrics.quarter.count} zaplacených faktur`,
                  icon: BarChart3,
                  label: "Kvartál",
                  value: formatCurrency(dashboard.metrics.quarter.total),
                },
                {
                  detail: `${dashboard.metrics.year.count} zaplacených faktur`,
                  icon: Gauge,
                  label: "Rok",
                  value: formatCurrency(dashboard.metrics.year.total),
                },
              ].map((metric) => (
                <article
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                  key={metric.label}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-zinc-500">
                      {metric.label}
                    </p>
                    <metric.icon
                      className="size-5 text-zinc-500"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-4 text-2xl font-semibold tracking-normal">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">{metric.detail}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Vývoj příjmů</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Založeno na zaplacených fakturách za posledních 12 měsíců
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/invoices?status=PAID">
                      Zobrazit zaplacené
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>

                <div className="mt-6 grid h-72 grid-cols-12 items-end gap-2 border-b border-l border-zinc-200 px-3 pb-8">
                  {dashboard.monthlyRevenue.map((month) => {
                    const height =
                      dashboard.maxMonthlyRevenue > 0
                        ? Math.max((month.total / dashboard.maxMonthlyRevenue) * 100, 4)
                        : 0;

                    return (
                      <div
                        className="relative flex h-full min-w-0 items-end"
                        key={month.key}
                      >
                        <div
                          className="w-full rounded-t-md bg-zinc-900 transition-all"
                          style={{ height: `${height}%` }}
                          title={`${month.label}: ${formatCurrency(month.total)}`}
                        />
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-zinc-500">
                          {month.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <aside className="flex flex-col gap-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-center gap-3">
                    <AlertTriangle
                      className="size-5 text-amber-700"
                      aria-hidden="true"
                    />
                    <h2 className="text-base font-semibold text-amber-950">
                      Po splatnosti
                    </h2>
                  </div>
                  <p className="mt-4 text-3xl font-semibold tracking-normal text-amber-950">
                    {formatCurrency(dashboard.metrics.overdue.total)}
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    {dashboard.metrics.overdue.count === 0
                      ? "Žádné dlužné faktury po splatnosti"
                      : `${dashboard.metrics.overdue.count} faktur čeká na úhradu`}
                  </p>
                  <Button asChild className="mt-5" variant="outline">
                    <Link href="/invoices?status=ISSUED">
                      Projít nezaplacené
                    </Link>
                  </Button>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <ReceiptText className="size-5 text-zinc-600" aria-hidden="true" />
                    <h2 className="text-base font-semibold">Nezaplaceno</h2>
                  </div>
                  <p className="mt-4 text-2xl font-semibold tracking-normal">
                    {formatCurrency(dashboard.metrics.unpaid.total)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {dashboard.metrics.unpaid.count} vystavených faktur bez úhrady
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-semibold">Limit DPH</h2>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full bg-emerald-600"
                      style={{ width: `${dashboard.metrics.vatLimit.percentage}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-500">12 měsíců</span>
                    <span className="font-medium">
                      {formatCurrency(dashboard.metrics.vatLimit.total)} /{" "}
                      {formatCurrency(dashboard.metrics.vatLimit.limit)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">
                    Zbývá {formatCurrency(dashboard.metrics.vatLimit.remaining)}.
                  </p>
                </div>
              </aside>
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-zinc-200 p-5">
                  <div>
                    <h2 className="text-base font-semibold">Poslední faktury</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Rychlá kontrola posledních vystavených dokladů
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/invoices">Všechny faktury</Link>
                  </Button>
                </div>

                {dashboard.recentInvoices.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText
                      className="mx-auto size-8 text-zinc-400"
                      aria-hidden="true"
                    />
                    <h3 className="mt-3 text-base font-semibold">
                      Zatím žádné faktury
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      Po vystavení první faktury se tady objeví poslední doklady.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead className="bg-zinc-100 text-left text-zinc-600">
                        <tr>
                          <th className="px-4 py-3 font-medium">Číslo</th>
                          <th className="px-4 py-3 font-medium">Odběratel</th>
                          <th className="px-4 py-3 font-medium">Splatnost</th>
                          <th className="px-4 py-3 text-right font-medium">
                            Celkem
                          </th>
                          <th className="px-4 py-3 font-medium">Stav</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.recentInvoices.map((invoice) => (
                          <tr className="border-t border-zinc-200" key={invoice.id}>
                            <td className="px-4 py-3 font-medium">
                              <Link
                                className="underline-offset-4 hover:underline"
                                href={`/invoices/${invoice.id}`}
                              >
                                {invoice.number}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-zinc-700">
                              {invoice.clientName}
                            </td>
                            <td className="px-4 py-3 text-zinc-700">
                              {formatDate(invoice.dueDate)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {formatCurrency(invoice.total)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                                {statusLabels[invoice.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <aside className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <PiggyBank className="size-5 text-zinc-600" aria-hidden="true" />
                  <h2 className="text-base font-semibold">Odhad odvodů</h2>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Orientačně pro příjmy roku, paušál 60 %, bez slev a minimálních
                  záloh.
                </p>
                <dl className="mt-5 grid gap-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Příjem</dt>
                    <dd className="font-medium">
                      {formatCurrency(dashboard.estimate.paidRevenue)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Paušální výdaje</dt>
                    <dd className="font-medium">
                      {formatCurrency(dashboard.estimate.flatExpenses)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3">
                    <dt className="text-zinc-500">Daňový základ</dt>
                    <dd className="font-medium">
                      {formatCurrency(dashboard.estimate.taxBase)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Daň 15 % před slevami</dt>
                    <dd className="font-medium">
                      {formatCurrency(dashboard.estimate.incomeTaxBeforeCredits)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Sociální pojistné</dt>
                    <dd className="font-medium">
                      {formatCurrency(dashboard.estimate.socialInsurance)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Zdravotní pojistné</dt>
                    <dd className="font-medium">
                      {formatCurrency(dashboard.estimate.healthInsurance)}
                    </dd>
                  </div>
                </dl>
              </aside>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

import Link from "next/link";
import { ArrowRight, FilePlus2, Users } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { buildDashboardData } from "@/lib/dashboard";
import {
  fromCents,
  getPaymentSummary,
  type InvoiceVisualState,
} from "@/lib/invoice-payment";
import { SIMPLIFICATIONS, type TaxSettings } from "@/lib/tax-estimate";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Po splatnosti ani částečná úhrada se v databázi neukládají, dopočítávají se
 * z data splatnosti a přijatých plateb. Štítek i barva proto vycházejí
 * z vizuálního stavu, ne ze syrového `status`.
 */
const visualStateLabels: Record<InvoiceVisualState, string> = {
  cancelled: "Stornováno",
  default: "Koncept",
  overdue: "Po splatnosti",
  paid: "Zaplaceno",
  partial: "Částečně uhrazeno",
  unpaid: "Vystaveno",
};

const visualStateVariants: Record<
  InvoiceVisualState,
  "default" | "success" | "warning" | "destructive" | "outline"
> = {
  cancelled: "outline",
  default: "default",
  overdue: "destructive",
  paid: "success",
  partial: "warning",
  unpaid: "warning",
};

async function getDashboardInvoices() {
  try {
    return await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        clientName: true,
        dueDate: true,
        id: true,
        issueDate: true,
        number: true,
        paidAmount: true,
        payments: { select: { amount: true, paidOn: true } },
        status: true,
        taxableSupplyDate: true,
        total: true,
      },
    });
  } catch {
    return null;
  }
}

/** Nastavení odvodů z profilu. Bez profilu se použijí výchozí hodnoty. */
async function getTaxSettings(): Promise<TaxSettings | undefined> {
  try {
    const profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: {
        activityType: true,
        applyTaxpayerCredit: true,
        flatExpenseRate: true,
        socialThreshold: true,
        taxpayerCredit: true,
      },
    });

    return profile ?? undefined;
  } catch {
    return undefined;
  }
}

export default async function Home() {
  const [invoices, taxSettings] = await Promise.all([
    getDashboardInvoices(),
    getTaxSettings(),
  ]);
  const dashboard = invoices
    ? buildDashboardData(invoices, new Date(), taxSettings)
    : null;
  const chartPositiveMax = dashboard
    ? Math.max(...dashboard.monthlyRevenue.map((month) => month.total), 0)
    : 0;
  const chartNegativeMax = dashboard
    ? Math.abs(Math.min(...dashboard.monthlyRevenue.map((month) => month.total), 0))
    : 0;
  const chartRange = chartPositiveMax + chartNegativeMax;
  const chartZero = chartRange > 0 ? (chartPositiveMax / chartRange) * 100 : 100;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Přehled"
        description="Příjmy, nezaplacené doklady a orientační odvody na jednom místě."
        actions={
          <>
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
          </>
        }
      />

      {dashboard === null ? (
        <Alert variant="destructive" title="Databáze není dostupná">
          Spusťte PostgreSQL a migrace, potom stránku obnovte.
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Přijaté platby</CardTitle>
              <CardDescription>Skutečné příjmy podle data úhrady</CardDescription>
            </CardHeader>
            <dl className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                { label: "Tento měsíc", metric: dashboard.metrics.month },
                { label: "Tento kvartál", metric: dashboard.metrics.quarter },
                { label: "Tento rok", metric: dashboard.metrics.year },
              ].map(({ label, metric }) => (
                <div key={label} className="min-w-0 space-y-2 px-5 py-5 sm:px-6">
                  <dt className="text-sm font-medium text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="text-2xl font-semibold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere]">
                    {formatCurrency(metric.total)}
                  </dd>
                  <dd className="text-xs text-muted-foreground">
                    {metric.count} faktur s úhradou
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-w-0">
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle>Vývoj příjmů</CardTitle>
                  <CardDescription>
                    Přijaté platby za posledních 12 měsíců
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/invoices?status=PAID">
                    Zaplacené
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardHeader>

              <CardContent className="p-5">
                {chartRange === 0 ? (
                  <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                    <p className="text-sm font-medium">Příjmy jsou zatím nulové</p>
                    <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                      Za posledních 12 měsíců jsou měsíční příjmy nulové. Graf
                      vychází z evidovaných plateb.
                    </p>
                  </div>
                ) : (
                  <figure aria-label="Měsíční příjmy za posledních 12 měsíců">
                    <div className="pb-7" aria-hidden="true">
                      <div className="relative grid h-56 grid-cols-12 gap-1.5 sm:gap-3">
                        <div
                          className="absolute inset-x-0 border-t border-border"
                          style={{ top: `${chartZero}%` }}
                        />
                        {dashboard.monthlyRevenue.map((month) => {
                          const height =
                            (Math.abs(month.total) / chartRange) * 100;

                          return (
                            <div className="relative h-full min-w-0" key={month.key}>
                              {month.total !== 0 ? (
                                <div
                                  className={`absolute w-full rounded-[3px] ${month.total < 0 ? "bg-destructive" : "bg-chart-1"}`}
                                  style={{
                                    height: `${height}%`,
                                    top: `${month.total < 0 ? chartZero : chartZero - height}%`,
                                  }}
                                  title={`${month.label} ${month.key.slice(0, 4)}: ${formatCurrency(month.total)}`}
                                />
                              ) : null}
                              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">
                                {month.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <figcaption className="text-xs text-muted-foreground">
                      {chartNegativeMax > 0
                        ? "Záporné příjmy jsou pod osou; zahrnují vrácené platby."
                        : "Příjmy zahrnují i částečné úhrady faktur."}
                    </figcaption>
                  </figure>
                )}
                <details className="mt-4 border-t border-border pt-3 text-xs">
                  <summary className="w-fit cursor-pointer rounded-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                    Zobrazit měsíční částky
                  </summary>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {dashboard.monthlyRevenue.map((month) => (
                      <div
                        key={month.key}
                        className="flex flex-wrap justify-between gap-2"
                      >
                        <dt className="text-muted-foreground">
                          {month.label} {month.key.slice(0, 4)}
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {formatCurrency(month.total)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>K inkasu</CardTitle>
                <CardDescription>
                  Zbývající částky na vystavených fakturách
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <dl className="space-y-4">
                  <div className="space-y-1.5">
                    <dt className="text-sm font-medium">Nezaplaceno</dt>
                    <dd className="text-xl font-semibold tabular-nums [overflow-wrap:anywhere]">
                      {formatCurrency(dashboard.metrics.unpaid.total)}
                    </dd>
                    <dd className="text-xs text-muted-foreground">
                      Zbývá doinkasovat u {dashboard.metrics.unpaid.count}{" "}
                      vystavených faktur
                    </dd>
                  </div>
                  <div className="space-y-1.5 border-t border-border pt-4">
                    <dt className="text-sm font-medium">Po splatnosti</dt>
                    <dd
                      className={`text-xl font-semibold tabular-nums [overflow-wrap:anywhere] ${dashboard.metrics.overdue.count > 0 ? "text-destructive" : ""}`}
                    >
                      {formatCurrency(dashboard.metrics.overdue.total)}
                    </dd>
                    <dd className="text-xs text-muted-foreground">
                      {dashboard.metrics.overdue.count === 0
                        ? "Nic po splatnosti"
                        : `Zbývá doinkasovat u ${dashboard.metrics.overdue.count} faktur`}
                    </dd>
                  </div>
                </dl>
                {dashboard.metrics.overdue.count > 0 ? (
                  <Button asChild className="w-full" size="sm" variant="outline">
                    <Link href="/invoices?status=OVERDUE">
                      Projít po splatnosti
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                ) : null}
                <div className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-sm font-medium">
                    Limit pro plátcovství DPH
                  </h3>
                  <p className="text-sm font-semibold leading-relaxed tabular-nums">
                    {formatCurrency(dashboard.metrics.vatLimit.total)}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      / {formatCurrency(dashboard.metrics.vatLimit.limit)}
                    </span>
                  </p>
                  <div
                    aria-label={`Využito ${Math.round(dashboard.metrics.vatLimit.percentage)} procent limitu`}
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                  >
                    <div
                      className={`h-full rounded-full ${
                        dashboard.metrics.vatLimit.percentage > 80
                          ? "bg-destructive"
                          : "bg-primary"
                      }`}
                      style={{
                        width: `${dashboard.metrics.vatLimit.percentage}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Za 12 měsíců. Zbývá{" "}
                    {formatCurrency(dashboard.metrics.vatLimit.remaining)}.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle>Poslední faktury</CardTitle>
                  <CardDescription>
                    Rychlá kontrola posledních dokladů
                  </CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/invoices">Všechny</Link>
                </Button>
              </CardHeader>

              {dashboard.recentInvoices.length === 0 ? (
                <EmptyState
                  title="Zatím žádné faktury"
                  description="Po vystavení první faktury se tady objeví poslední doklady."
                  action={
                    <Button asChild size="sm">
                      <Link href="/invoices/new">Vystavit fakturu</Link>
                    </Button>
                  }
                />
              ) : (
                <>
                  <ul className="divide-y divide-border md:hidden">
                    {dashboard.recentInvoices.map((invoice) => {
                      const summary = getPaymentSummary(invoice);

                      return (
                        <li key={invoice.id}>
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="block space-y-2 px-5 py-4 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <span className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">
                                {invoice.number}
                              </span>
                              <span className="text-sm font-semibold tabular-nums">
                                {formatCurrency(invoice.total)}
                              </span>
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                              {invoice.clientName}
                            </p>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge
                                dot
                                variant={visualStateVariants[invoice.visualState]}
                              >
                                {visualStateLabels[invoice.visualState]}
                              </Badge>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                Splatnost {formatDate(invoice.dueDate)}
                              </span>
                            </div>
                            {summary.isPartiallyPaid ? (
                              <p className="text-xs tabular-nums text-muted-foreground">
                                Zbývá{" "}
                                {formatCurrency(fromCents(summary.remainingCents))}
                              </p>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <TableWrapper className="hidden md:block">
                    <Table className="min-w-[640px]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Číslo</TableHead>
                          <TableHead>Odběratel</TableHead>
                          <TableHead>Splatnost</TableHead>
                          <TableHead className="text-right">Celkem</TableHead>
                          <TableHead>Stav</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.recentInvoices.map((invoice) => {
                          const summary = getPaymentSummary(invoice);

                          return (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-medium">
                                <Link
                                  className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                  href={`/invoices/${invoice.id}`}
                                >
                                  {invoice.number}
                                </Link>
                              </TableCell>
                              <TableCell>{invoice.clientName}</TableCell>
                              <TableCell className="tabular-nums text-muted-foreground">
                                {formatDate(invoice.dueDate)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatCurrency(invoice.total)}
                                {summary.isPartiallyPaid ? (
                                  <span className="block text-xs font-normal text-muted-foreground">
                                    Zbývá{" "}
                                    {formatCurrency(
                                      fromCents(summary.remainingCents),
                                    )}
                                  </span>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  dot
                                  variant={
                                    visualStateVariants[invoice.visualState]
                                  }
                                >
                                  {visualStateLabels[invoice.visualState]}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableWrapper>
                </>
              )}
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Odhad odvodů</CardTitle>
                <CardDescription>
                  {dashboard.estimate.isSecondary
                    ? "Vedlejší činnost. Doplácí se najednou po podání přiznání a přehledů."
                    : "Hlavní činnost. Orientačně z letošních přijatých plateb."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 p-5">
                <div className="border-b border-border pb-5">
                  <p className="text-sm font-medium text-muted-foreground">
                    Odhad k doplacení
                  </p>
                  <p className="pt-2 text-2xl font-semibold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere]">
                    {formatCurrency(dashboard.estimate.total)}
                  </p>
                  <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
                    Ze základu {formatCurrency(dashboard.estimate.taxBase)} po
                    odečtení {formatCurrency(dashboard.estimate.flatExpenses)}{" "}
                    paušálních výdajů.
                  </p>
                </div>

                <dl className="space-y-4 text-sm">
                  {[
                    {
                      amount: dashboard.estimate.incomeTax.amount,
                      label: "Daň z příjmu",
                      note: dashboard.estimate.incomeTax.note,
                    },
                    {
                      amount: dashboard.estimate.social.amount,
                      label: "Sociální pojistné",
                      note: dashboard.estimate.social.note,
                    },
                    {
                      amount: dashboard.estimate.health.amount,
                      label: "Zdravotní pojistné",
                      note: dashboard.estimate.health.note,
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1"
                    >
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd
                        className={
                          row.amount === 0
                            ? "font-medium tabular-nums text-success"
                            : "font-medium tabular-nums"
                        }
                      >
                        {formatCurrency(row.amount)}
                      </dd>
                      <dd className="col-span-2 text-xs leading-relaxed text-muted-foreground">
                        {row.note}
                      </dd>
                    </div>
                  ))}
                </dl>

                {dashboard.estimate.social.remainingToThreshold !== null &&
                dashboard.estimate.social.remainingToThreshold > 0 ? (
                  <Alert
                    variant="info"
                    title={`Do rozhodné částky zbývá ${formatCurrency(
                      dashboard.estimate.social.remainingToThreshold,
                    )} zisku`}
                  >
                    Po jejím překročení se sociální pojistné začne platit zpětně
                    za celý rok.
                  </Alert>
                ) : null}

                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer rounded-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Co odhad neumí
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {SIMPLIFICATIONS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="mt-2">
                    Sazby a částky si nastavíš v{" "}
                    <Link
                      className="underline underline-offset-4"
                      href="/settings/profile"
                    >
                      profilu
                    </Link>
                    . Nenahrazuje daňového poradce.
                  </p>
                </details>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

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
import { StatCard } from "@/components/ui/stat-card";
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
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              detail={`${dashboard.metrics.month.count} faktur s úhradou`}
              label="Tento měsíc"
              value={formatCurrency(dashboard.metrics.month.total)}
            />
            <StatCard
              detail={`${dashboard.metrics.quarter.count} faktur s úhradou`}
              label="Tento kvartál"
              value={formatCurrency(dashboard.metrics.quarter.total)}
            />
            <StatCard
              detail={`${dashboard.metrics.year.count} faktur s úhradou`}
              label="Tento rok"
              value={formatCurrency(dashboard.metrics.year.total)}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-4">
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

              <CardContent className="flex flex-1 flex-col p-5 pb-3">
                <div className="grid min-h-56 flex-1 grid-cols-12 items-end gap-1.5 border-b border-border pb-8">
                  {dashboard.monthlyRevenue.map((month) => {
                    const height =
                      dashboard.maxMonthlyRevenue > 0
                        ? Math.max(
                            (month.total / dashboard.maxMonthlyRevenue) * 100,
                            month.total > 0 ? 3 : 1,
                          )
                        : 1;

                    return (
                      <div
                        className="relative flex h-full min-w-0 items-end"
                        key={month.key}
                      >
                        <div
                          className={`w-full rounded-t-[3px] transition-colors ${
                            month.total > 0
                              ? "bg-chart-1 hover:bg-primary"
                              : "bg-border"
                          }`}
                          style={{ height: `${height}%` }}
                          title={`${month.label}: ${formatCurrency(month.total)}`}
                        />
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] tabular-nums text-muted-foreground">
                          {month.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <StatCard
                detail={
                  dashboard.metrics.overdue.count === 0
                    ? "Nic po splatnosti"
                    : `Zbývá doinkasovat u ${dashboard.metrics.overdue.count} faktur`
                }
                footer={
                  dashboard.metrics.overdue.count > 0 ? (
                    <Button asChild className="w-full" size="sm" variant="outline">
                      <Link href="/invoices?status=OVERDUE">
                        Projít po splatnosti
                      </Link>
                    </Button>
                  ) : null
                }
                label="Po splatnosti"
                tone={
                  dashboard.metrics.overdue.count > 0 ? "attention" : "default"
                }
                value={formatCurrency(dashboard.metrics.overdue.total)}
              />

              <StatCard
                detail={`Zbývá doinkasovat u ${dashboard.metrics.unpaid.count} vystavených faktur`}
                label="Nezaplaceno"
                value={formatCurrency(dashboard.metrics.unpaid.total)}
              />

              <Card>
                <CardContent className="space-y-3 p-5">
                  <p className="text-eyebrow text-muted-foreground">
                    Limit pro plátcovství DPH
                  </p>
                  <p className="text-lg font-semibold leading-none tabular-nums">
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
                  <p className="text-[0.8125rem] text-muted-foreground">
                    Za 12 měsíců. Zbývá{" "}
                    {formatCurrency(dashboard.metrics.vatLimit.remaining)}.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-start justify-between gap-4">
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
                <TableWrapper>
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
                                className="underline-offset-4 hover:underline"
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
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Odhad odvodů</CardTitle>
                <CardDescription>
                  {dashboard.estimate.isSecondary
                    ? "Vedlejší činnost. Doplácí se najednou po podání přiznání a přehledů."
                    : "Hlavní činnost. Orientačně z letošních přijatých plateb."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 p-5">
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-eyebrow text-muted-foreground">
                    Odhad k doplacení
                  </p>
                  <p className="pt-1.5 text-2xl font-semibold leading-none tracking-tight">
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
                    <div key={row.label}>
                      <div className="flex justify-between gap-4">
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
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {row.note}
                      </p>
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
                  <summary className="cursor-pointer font-medium text-foreground">
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

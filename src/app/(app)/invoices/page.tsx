import Link from "next/link";
import { FilePlus2, FileText, Search } from "lucide-react";

import { InvoiceBulkTable } from "@/components/invoices/invoice-bulk-table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InputField, SelectField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceStatus } from "@/generated/prisma/enums";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  [InvoiceStatus.CANCELLED]: "Stornováno",
  [InvoiceStatus.DRAFT]: "Koncept",
  [InvoiceStatus.ISSUED]: "Vystaveno",
  [InvoiceStatus.OVERDUE]: "Po splatnosti",
  [InvoiceStatus.PAID]: "Zaplaceno",
};

type VisualState = "default" | "unpaid" | "overdue" | "paid" | "cancelled";

/**
 * Stav po splatnosti se dopočítává z data, v databázi zůstává ISSUED.
 * Štítek proto bereme z vizuálního stavu, ať barva i text říkají totéž.
 */
const visualStateLabels: Record<VisualState, string> = {
  cancelled: statusLabels[InvoiceStatus.CANCELLED],
  default: statusLabels[InvoiceStatus.DRAFT],
  overdue: statusLabels[InvoiceStatus.OVERDUE],
  paid: statusLabels[InvoiceStatus.PAID],
  unpaid: statusLabels[InvoiceStatus.ISSUED],
};

function getInvoiceVisualState(invoice: {
  dueDate: Date;
  paidAt: Date | null;
  status: InvoiceStatus;
}): VisualState {
  if (invoice.status === InvoiceStatus.CANCELLED) {
    return "cancelled";
  }

  if (invoice.status === InvoiceStatus.PAID || invoice.paidAt !== null) {
    return "paid";
  }

  if (invoice.status !== InvoiceStatus.ISSUED) {
    return "default";
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return invoice.dueDate < todayStart ? "overdue" : "unpaid";
}

async function getInvoices({
  query,
  status,
}: {
  query?: string;
  status?: InvoiceStatus;
}) {
  try {
    return await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        ...(status ? { status } : {}),
        // Hledáme v údajích zamrzlých na faktuře, ne v aktuálním adresáři.
        ...(query
          ? {
              OR: [
                { number: { contains: query, mode: "insensitive" } },
                { clientName: { contains: query, mode: "insensitive" } },
                { variableSymbol: { contains: query } },
              ],
            }
          : {}),
      },
    });
  } catch {
    return null;
  }
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const queryParam = typeof params?.q === "string" ? params.q.trim() : "";
  const statusParam = typeof params?.status === "string" ? params.status : "";
  const statusValues = Object.values(InvoiceStatus);
  const statusFilter = statusValues.includes(statusParam as InvoiceStatus)
    ? (statusParam as InvoiceStatus)
    : undefined;
  const invoices = await getInvoices({
    query: queryParam || undefined,
    status: statusFilter,
  });
  const hasFilters = Boolean(queryParam || statusFilter);
  const deletedCount = typeof params?.deleted === "string" ? params.deleted : "";
  const bulkErrorMessage =
    params?.bulkError === "empty"
      ? "Vyberte alespoň jednu fakturu."
      : params?.bulkError === "db"
        ? "Vybrané faktury se nepodařilo smazat, protože databáze není dostupná."
        : null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Faktury"
        description="Přehled vystavených dokladů, jejich stavu a splatnosti."
        actions={
          <Button asChild>
            <Link href="/invoices/new">
              <FilePlus2 className="size-4" aria-hidden="true" />
              Nová faktura
            </Link>
          </Button>
        }
      />

      {invoices === null ? (
        <Alert variant="destructive" title="Databáze není dostupná">
          Spusťte PostgreSQL a migrace, potom stránku obnovte.
        </Alert>
      ) : null}

      {deletedCount ? (
        <Alert variant="success" title={`Smazáno faktur: ${deletedCount}.`} />
      ) : null}

      {bulkErrorMessage ? (
        <Alert variant="destructive" title={bulkErrorMessage} />
      ) : null}

      {invoices !== null ? (
        <Card>
          <CardContent className="p-4">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
              method="get"
            >
              <InputField
                className="sm:w-72"
                label="Hledat"
                name="q"
                placeholder="Číslo, odběratel nebo VS"
                defaultValue={queryParam}
              />
              <SelectField
                className="sm:w-56"
                label="Stav"
                name="status"
                defaultValue={statusFilter ?? ""}
              >
                <option value="">Všechny</option>
                {statusValues.map((value) => (
                  <option key={value} value={value}>
                    {statusLabels[value] ?? value}
                  </option>
                ))}
              </SelectField>
              <div className="flex gap-2">
                <Button type="submit" variant="outline">
                  <Search className="size-4" aria-hidden="true" />
                  Filtrovat
                </Button>
                {hasFilters ? (
                  <Button asChild variant="ghost">
                    <Link href="/invoices">Zrušit filtry</Link>
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {invoices !== null && invoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={hasFilters ? "Nic nenalezeno" : "Zatím žádné faktury"}
            description={
              hasFilters
                ? "Upravte hledání nebo zrušte filtry a zkuste to znovu."
                : "Vystavte první fakturu a tady uvidíte její stav, částku i splatnost."
            }
            action={
              hasFilters ? (
                <Button asChild variant="outline">
                  <Link href="/invoices">Zrušit filtry</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/invoices/new">Vystavit první fakturu</Link>
                </Button>
              )
            }
          />
        </Card>
      ) : null}

      {invoices !== null && invoices.length > 0 ? (
        <InvoiceBulkTable
          invoices={invoices.map((invoice) => {
            const visualState = getInvoiceVisualState(invoice);

            return {
              clientName: invoice.clientName || "—",
              dueDate: formatDate(invoice.dueDate),
              href: `/invoices/${invoice.id}`,
              id: invoice.id,
              issueDate: formatDate(invoice.issueDate),
              number: invoice.number,
              statusLabel:
                visualStateLabels[visualState] ??
                statusLabels[invoice.status] ??
                invoice.status,
              total: formatCurrency(invoice.total),
              visualState,
            };
          })}
        />
      ) : null}
    </div>
  );
}

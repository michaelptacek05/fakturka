import Link from "next/link";
import { FilePlus2, Search } from "lucide-react";

import { InvoiceBulkTable } from "@/components/invoices/invoice-bulk-table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InputField, SelectField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceStatus } from "@/generated/prisma/enums";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  fromCents,
  getInvoiceVisualState,
  getPaymentSummary,
  type InvoiceVisualState,
} from "@/lib/invoice-payment";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  [InvoiceStatus.CANCELLED]: "Stornováno",
  [InvoiceStatus.DRAFT]: "Koncept",
  [InvoiceStatus.ISSUED]: "Vystaveno",
  [InvoiceStatus.OVERDUE]: "Po splatnosti",
  [InvoiceStatus.PAID]: "Zaplaceno",
};

/**
 * Filtr pracuje s vizuálním stavem, ne se sloupcem `status` — jinak by
 * „Po splatnosti“ nevrátilo nic (do databáze se OVERDUE nikdy nezapisuje)
 * a „Částečně uhrazeno“ by nešlo vyfiltrovat vůbec. Klíče zůstávají stejné
 * jako dřív, aby odkazy typu `/invoices?status=PAID` dál fungovaly.
 */
const filterStates: Record<string, InvoiceVisualState> = {
  [InvoiceStatus.CANCELLED]: "cancelled",
  [InvoiceStatus.DRAFT]: "default",
  [InvoiceStatus.ISSUED]: "unpaid",
  [InvoiceStatus.OVERDUE]: "overdue",
  [InvoiceStatus.PAID]: "paid",
  PARTIAL: "partial",
};

/** Pořadí voleb ve výběru. Odpovídá cestě dokladu od vystavení k zaplacení. */
const filterOrder = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.ISSUED,
  "PARTIAL",
  InvoiceStatus.OVERDUE,
  InvoiceStatus.PAID,
  InvoiceStatus.CANCELLED,
];

/**
 * Stav po splatnosti ani částečná úhrada nejsou v databázi — dopočítávají se.
 * Štítek proto bereme z vizuálního stavu, ať barva i text říkají totéž.
 */
const visualStateLabels: Record<InvoiceVisualState, string> = {
  cancelled: statusLabels[InvoiceStatus.CANCELLED],
  default: statusLabels[InvoiceStatus.DRAFT],
  overdue: statusLabels[InvoiceStatus.OVERDUE],
  paid: statusLabels[InvoiceStatus.PAID],
  partial: "Částečně uhrazeno",
  unpaid: statusLabels[InvoiceStatus.ISSUED],
};

async function getInvoices({ query }: { query?: string }) {
  try {
    return await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      where: {
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
  const statusFilter = statusParam in filterStates ? statusParam : undefined;
  const filteredState = statusFilter ? filterStates[statusFilter] : undefined;
  const allInvoices = await getInvoices({ query: queryParam || undefined });
  // Seznam se stejně načítá celý, takže filtrujeme až tady — stav se tím počítá
  // jedinou funkcí a filtr nemůže říct něco jiného než štítek u řádku.
  const invoices =
    allInvoices === null || filteredState === undefined
      ? allInvoices
      : allInvoices.filter(
          (invoice) => getInvoiceVisualState(invoice) === filteredState,
        );
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
                {filterOrder.map((value) => (
                  <option key={value} value={value}>
                    {visualStateLabels[filterStates[value]]}
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
            const summary = getPaymentSummary(invoice);

            return {
              clientName: invoice.clientName || "—",
              dueDate: formatDate(invoice.dueDate),
              href: `/invoices/${invoice.id}`,
              id: invoice.id,
              issueDate: formatDate(invoice.issueDate),
              number: invoice.number,
              remaining: summary.isPartiallyPaid
                ? formatCurrency(fromCents(summary.remainingCents))
                : undefined,
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

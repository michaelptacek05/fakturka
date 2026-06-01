import Link from "next/link";
import { FilePlus2 } from "lucide-react";

import { InvoiceBulkTable } from "@/components/invoices/invoice-bulk-table";
import { Button } from "@/components/ui/button";
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

async function getInvoices({
  query,
  status,
}: {
  query?: string;
  status?: InvoiceStatus;
}) {
  try {
    return await prisma.invoice.findMany({
      include: {
        client: true,
      },
      where: {
        ...(status ? { status } : {}),
        ...(query
          ? {
              OR: [
                { number: { contains: query, mode: "insensitive" } },
                {
                  client: {
                    OR: [
                      {
                        companyName: {
                          contains: query,
                          mode: "insensitive",
                        },
                      },
                      { fullName: { contains: query, mode: "insensitive" } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
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
  const flashMessage = deletedCount
    ? `Smazáno faktur: ${deletedCount}.`
    : null;
  const bulkErrorMessage =
    params?.bulkError === "empty"
      ? "Vyberte alespoň jednu fakturu."
      : params?.bulkError === "db"
        ? "Vybrané faktury se nepodařilo smazat, protože databáze není dostupná."
        : null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Faktury</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            Přehled faktur
          </h1>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <FilePlus2 className="size-4" aria-hidden="true" />
            Nová faktura
          </Link>
        </Button>
      </div>

      {invoices === null ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Databáze není dostupná. Spusťte PostgreSQL a migrace, potom stránku
          obnovte.
        </section>
      ) : (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            method="get"
          >
            <label className="grid gap-1 text-sm font-medium text-zinc-700">
              Hledat
              <input
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                name="q"
                placeholder="Číslo faktury nebo odběratel"
                defaultValue={queryParam}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-zinc-700">
              Stav
              <select
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                name="status"
                defaultValue={statusFilter ?? ""}
              >
                <option value="">Všechny</option>
                {statusValues.map((value) => (
                  <option key={value} value={value}>
                    {statusLabels[value] ?? value}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline">
              Filtrovat
            </Button>
            {hasFilters ? (
              <Button asChild variant="ghost">
                <Link href="/invoices">Zrušit filtry</Link>
              </Button>
            ) : null}
          </form>
        </section>
      )}

      {flashMessage ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {flashMessage}
        </section>
      ) : null}

      {bulkErrorMessage ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {bulkErrorMessage}
        </section>
      ) : null}

      {invoices !== null && invoices.length === 0 ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold">
            {hasFilters ? "Nic nenalezeno" : "Zatím žádné faktury"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {hasFilters
              ? "Upravte hledání nebo zrušte filtry a zkuste to znovu."
              : "Vystavte první fakturu a tady uvidíte její stav, částku i splatnost."}
          </p>
          {!hasFilters ? (
            <Button asChild className="mt-5">
              <Link href="/invoices/new">Vystavit první fakturu</Link>
            </Button>
          ) : null}
        </section>
      ) : null}

      {invoices !== null && invoices.length > 0 ? (
        <InvoiceBulkTable
          invoices={invoices.map((invoice) => ({
            clientName: invoice.client.companyName ?? invoice.client.fullName ?? "-",
            dueDate: formatDate(invoice.dueDate),
            href: `/invoices/${invoice.id}`,
            id: invoice.id,
            issueDate: formatDate(invoice.issueDate),
            number: invoice.number,
            statusLabel: statusLabels[invoice.status] ?? invoice.status,
            total: formatCurrency(invoice.total),
          }))}
        />
      ) : null}
    </main>
  );
}

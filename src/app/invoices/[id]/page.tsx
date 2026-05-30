import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { InvoiceStatusActions } from "@/components/invoices/invoice-status-actions";
import { PaymentQr } from "@/components/invoices/payment-qr";
import { PrintButton } from "@/components/invoices/print-button";
import { Button } from "@/components/ui/button";
import { VatPayerStatus } from "@/generated/prisma/enums";
import { formatCurrency, formatDate, numberFormatter } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type InvoiceDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getInvoice(id: string) {
  try {
    return await prisma.invoice.findUnique({
      include: {
        client: true,
        items: {
          orderBy: { position: "asc" },
        },
        profile: true,
      },
      where: { id },
    });
  } catch {
    return null;
  }
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: InvoiceDetailPageProps) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  const query = await searchParams;

  const flashMessage =
    query?.saved === "1"
      ? "Změny faktury byly uloženy."
      : query?.paid === "1"
        ? "Faktura byla označena jako zaplacená."
        : query?.cancelled === "1"
          ? "Faktura byla stornována."
          : null;
  const errorMessage =
    query?.error === "db"
      ? "Akci se nepodařilo dokončit, protože databáze není dostupná."
      : query?.error === "readonly"
        ? "Tuto akci nelze provést, protože je faktura stornovaná."
        : null;

  if (!invoice) {
    notFound();
  }

  const supplierName = invoice.profile.companyName || invoice.profile.displayName;
  const clientName = invoice.client.companyName || invoice.client.fullName || "";
  const isVatPayer = invoice.profile.vatPayerStatus === VatPayerStatus.PAYER;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 print:block print:max-w-none print:p-0">
      <div className="print-hidden flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Faktura</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            {invoice.number}
          </h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button asChild variant="outline">
            <Link href="/invoices">Zpět na faktury</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/invoices/${invoice.id}/edit`}>Upravit</Link>
          </Button>
          <InvoiceStatusActions invoiceId={invoice.id} status={invoice.status} />
          <Button asChild variant="outline">
            <Link href={`/invoices/${invoice.id}/pdf`}>
              <Download className="size-4" aria-hidden="true" />
              Stáhnout PDF
            </Link>
          </Button>
          <PrintButton />
        </div>
      </div>

      {flashMessage ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {flashMessage}
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {errorMessage}
        </section>
      ) : null}

      <article className="print-sheet mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-8 text-zinc-950 shadow-sm ring-1 ring-zinc-200 print:min-h-0 print:w-auto print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <header className="flex flex-col gap-8 border-b-2 border-zinc-950 pb-8 sm:flex-row sm:items-start sm:justify-between print:flex-row">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              {isVatPayer ? "Faktura - daňový doklad" : "Faktura"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal">
              {invoice.number}
            </h2>
          </div>
          <div className="text-left text-sm sm:text-right print:text-right">
            <p className="font-semibold">{supplierName}</p>
            <p>{invoice.profile.street}</p>
            <p>
              {invoice.profile.postalCode} {invoice.profile.city}
            </p>
            <p>{invoice.profile.country}</p>
          </div>
        </header>

        <section className="grid gap-8 border-b border-zinc-300 py-8 sm:grid-cols-2 print:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Dodavatel
            </h3>
            <div className="mt-3 text-sm leading-6">
              <p className="font-semibold">{supplierName}</p>
              <p>{invoice.profile.street}</p>
              <p>
                {invoice.profile.postalCode} {invoice.profile.city}
              </p>
              <p>{invoice.profile.country}</p>
              <p>IČO: {invoice.profile.ico}</p>
              {invoice.profile.dic ? <p>DIČ: {invoice.profile.dic}</p> : null}
              {invoice.profile.registryText ? (
                <p className="mt-2 text-zinc-600">{invoice.profile.registryText}</p>
              ) : null}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Odběratel
            </h3>
            <div className="mt-3 text-sm leading-6">
              <p className="font-semibold">{clientName}</p>
              <p>{invoice.client.street}</p>
              <p>
                {invoice.client.postalCode} {invoice.client.city}
              </p>
              <p>{invoice.client.country}</p>
              {invoice.client.ico ? <p>IČO: {invoice.client.ico}</p> : null}
              {invoice.client.dic ? <p>DIČ: {invoice.client.dic}</p> : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-b border-zinc-300 py-6 text-sm sm:grid-cols-3 print:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Datum vystavení
            </p>
            <p className="mt-1 font-medium">{formatDate(invoice.issueDate)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">DUZP</p>
            <p className="mt-1 font-medium">
              {invoice.taxableSupplyDate
                ? formatDate(invoice.taxableSupplyDate)
                : formatDate(invoice.issueDate)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Datum splatnosti
            </p>
            <p className="mt-1 font-medium">{formatDate(invoice.dueDate)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Variabilní symbol
            </p>
            <p className="mt-1 font-medium">{invoice.variableSymbol}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Konstantní symbol
            </p>
            <p className="mt-1 font-medium">{invoice.constantSymbol || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Specifický symbol
            </p>
            <p className="mt-1 font-medium">{invoice.specificSymbol || "-"}</p>
          </div>
        </section>

        <section className="py-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-950 text-left">
                <th className="py-3 pr-3 font-semibold">Položka</th>
                <th className="px-3 py-3 text-right font-semibold">Množství</th>
                <th className="px-3 py-3 text-right font-semibold">Cena / j.</th>
                <th className="px-3 py-3 text-right font-semibold">DPH</th>
                <th className="py-3 pl-3 text-right font-semibold">Celkem</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr className="border-b border-zinc-200" key={item.id}>
                  <td className="py-3 pr-3">{item.name}</td>
                  <td className="px-3 py-3 text-right">
                    {numberFormatter.format(Number(item.quantity))} {item.unit}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {numberFormatter.format(Number(item.vatRate))} %
                  </td>
                  <td className="py-3 pl-3 text-right font-medium">
                    {formatCurrency(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-6 border-t border-zinc-300 pt-6 sm:grid-cols-[minmax(0,1fr)_270px] print:grid-cols-[minmax(0,1fr)_270px]">
          <div className="min-w-0 text-sm leading-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Platební údaje
            </h3>
            <p className="mt-3">
              Číslo účtu:{" "}
              <strong>
                {invoice.profile.accountNumber}/{invoice.profile.bankCode}
              </strong>
            </p>
            {invoice.profile.iban ? <p>IBAN: {invoice.profile.iban}</p> : null}
            {invoice.profile.swift ? <p>SWIFT: {invoice.profile.swift}</p> : null}
            <p>Variabilní symbol: {invoice.variableSymbol}</p>
            <PaymentQr
              accountNumber={invoice.profile.accountNumber}
              amount={invoice.total}
              bankCode={invoice.profile.bankCode}
              currency={invoice.currency}
              dueDate={invoice.dueDate}
              iban={invoice.profile.iban}
              invoiceNumber={invoice.number}
              swift={invoice.profile.swift}
              variableSymbol={invoice.variableSymbol}
            />
            {invoice.notes ? <p className="mt-5 text-zinc-700">{invoice.notes}</p> : null}
          </div>

          <div className="grid min-w-0 content-start gap-2 text-sm">
            <div className="flex justify-between">
              <span>Mezisoučet</span>
              <strong>{formatCurrency(invoice.subtotal)}</strong>
            </div>
            <div className="flex justify-between">
              <span>DPH</span>
              <strong>{formatCurrency(invoice.vatTotal)}</strong>
            </div>
            <div className="mt-2 flex justify-between border-t-2 border-zinc-950 pt-3 text-lg">
              <span>Celkem k úhradě</span>
              <strong>{formatCurrency(invoice.total)}</strong>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}

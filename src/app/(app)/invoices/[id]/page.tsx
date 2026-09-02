import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Pencil } from "lucide-react";

import { InvoiceStatusActions } from "@/components/invoices/invoice-status-actions";
import { PaymentQr } from "@/components/invoices/payment-qr";
import { PrintButton } from "@/components/invoices/print-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceAssetType, InvoiceStatus, VatPayerStatus } from "@/generated/prisma/enums";
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
        items: {
          orderBy: { position: "asc" },
        },
        profile: {
          include: {
            assets: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      where: { id },
    });
  } catch {
    return null;
  }
}

function getStatusBadge(invoice: {
  dueDate: Date;
  paidAt: Date | null;
  status: InvoiceStatus;
}) {
  if (invoice.status === InvoiceStatus.CANCELLED) {
    return { label: "Stornováno", variant: "outline" as const };
  }

  if (invoice.status === InvoiceStatus.PAID) {
    return { label: "Zaplaceno", variant: "success" as const };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (invoice.status === InvoiceStatus.ISSUED && invoice.dueDate < todayStart) {
    return { label: "Po splatnosti", variant: "destructive" as const };
  }

  if (invoice.status === InvoiceStatus.ISSUED) {
    return { label: "Vystaveno", variant: "warning" as const };
  }

  return { label: "Koncept", variant: "default" as const };
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
  const clientName = invoice.clientName;
  const isVatPayer = invoice.profile.vatPayerStatus === VatPayerStatus.PAYER;
  const status = getStatusBadge(invoice);
  const logo = invoice.profile.assets.find(
    (asset) => asset.type === InvoiceAssetType.LOGO,
  );
  const signature = invoice.profile.assets.find(
    (asset) => asset.type === InvoiceAssetType.SIGNATURE,
  );
  const stamp = invoice.profile.assets.find(
    (asset) => asset.type === InvoiceAssetType.STAMP,
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 print:block print:max-w-none print:p-0">
      <div className="print-hidden flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            asChild
            variant="link"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <Link href="/invoices">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Zpět na faktury
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {invoice.number}
            </h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {clientName} · splatnost {formatDate(invoice.dueDate)}
            {invoice.paidAt ? ` · uhrazeno ${formatDate(invoice.paidAt)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href={`/invoices/${invoice.id}/edit`}>
              <Pencil className="size-4" aria-hidden="true" />
              Upravit
            </Link>
          </Button>
          <InvoiceStatusActions invoiceId={invoice.id} status={invoice.status} />
          <Button asChild variant="outline" size="sm">
            <Link href={`/invoices/${invoice.id}/pdf`}>
              <Download className="size-4" aria-hidden="true" />
              PDF
            </Link>
          </Button>
          <PrintButton />
        </div>
      </div>

      {flashMessage ? (
        <div className="print-hidden">
          <Alert variant="success" title={flashMessage} />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="print-hidden">
          <Alert variant="destructive" title={errorMessage} />
        </div>
      ) : null}

      {/*
        List faktury zůstává vždy světlý — je to náhled tiskového dokumentu,
        takže se záměrně neřídí tmavým motivem aplikace.
      */}
      <article className="print-sheet mx-auto min-h-[297mm] w-full max-w-[210mm] rounded-lg bg-white p-8 text-zinc-950 shadow-sm ring-1 ring-zinc-200 print:min-h-0 print:w-auto print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <header className="flex flex-col gap-8 border-b-2 border-zinc-950 pb-8 sm:flex-row sm:items-start sm:justify-between print:flex-row">
          <div className="flex items-start gap-4">
            {logo ? (
              <Image
                src={`/invoice-assets/${logo.id}`}
                alt="Logo"
                width={96}
                height={64}
                className="max-h-16 w-auto object-contain"
                unoptimized
              />
            ) : null}
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                {isVatPayer ? "Faktura — daňový doklad" : "Faktura"}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                {invoice.number}
              </h2>
            </div>
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
                <p className="mt-2 text-zinc-600">
                  {invoice.profile.registryText}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Odběratel
            </h3>
            <div className="mt-3 text-sm leading-6">
              <p className="font-semibold">{clientName}</p>
              <p>{invoice.clientStreet}</p>
              <p>
                {invoice.clientPostalCode} {invoice.clientCity}
              </p>
              <p>{invoice.clientCountry}</p>
              {invoice.clientIco ? <p>IČO: {invoice.clientIco}</p> : null}
              {invoice.clientDic ? <p>DIČ: {invoice.clientDic}</p> : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-b border-zinc-300 py-6 text-sm sm:grid-cols-3 print:grid-cols-3">
          {[
            {
              label: "Datum vystavení",
              value: formatDate(invoice.issueDate),
            },
            {
              label: "DUZP",
              value: formatDate(invoice.taxableSupplyDate ?? invoice.issueDate),
            },
            {
              label: "Datum splatnosti",
              value: formatDate(invoice.dueDate),
            },
            {
              label: "Variabilní symbol",
              value: invoice.variableSymbol,
            },
            {
              label: "Konstantní symbol",
              value: invoice.constantSymbol || "—",
            },
            {
              label: "Specifický symbol",
              value: invoice.specificSymbol || "—",
            },
          ].map((entry) => (
            <div key={entry.label}>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {entry.label}
              </p>
              <p className="mt-1 font-medium">{entry.value}</p>
            </div>
          ))}
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
                <tr
                  className="border-b border-zinc-200 print-break-inside-avoid"
                  key={item.id}
                >
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
            {invoice.profile.swift ? (
              <p>SWIFT: {invoice.profile.swift}</p>
            ) : null}
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
            {signature || stamp ? (
              <div className="mt-5 flex flex-wrap items-end gap-4">
                {signature ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Podpis
                    </p>
                    <Image
                      src={`/invoice-assets/${signature.id}`}
                      alt="Podpis"
                      width={160}
                      height={80}
                      className="mt-2 max-h-20 w-auto object-contain"
                      unoptimized
                    />
                  </div>
                ) : null}
                {stamp ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Razítko
                    </p>
                    <Image
                      src={`/invoice-assets/${stamp.id}`}
                      alt="Razítko"
                      width={120}
                      height={90}
                      className="mt-2 max-h-24 w-auto object-contain"
                      unoptimized
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            {invoice.notes ? (
              <p className="mt-5 text-zinc-700">{invoice.notes}</p>
            ) : null}
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
    </div>
  );
}
